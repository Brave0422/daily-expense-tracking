/**
 * @author Brave
 * @date 2026-09-27T13:10:03+08:00
 * @description 标签服务单元测试，验证用户隔离、归档过滤和名称唯一性。
 */

import {
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { EntityManager, IsNull, Repository } from 'typeorm';
import { TagEntity } from './entities/tag.entity';
import { TagsService } from './tags.service';
import { UserEntity } from '../users/entities/user.entity';

jest.mock('@nestjs/typeorm', () => ({
  InjectRepository: () => () => undefined,
}));
// 服务测试只需要仓库标识，不加载带有 src/* 关联导入的实体依赖链。
jest.mock('./entities/tag.entity', () => ({ TagEntity: class TagEntity {} }));

describe('TagsService', () => {
  const tag: TagEntity = {
    id: 1,
    ownerUserId: 7,
    name: '出差',
    archivedTime: null,
    createdTime: new Date(),
    updatedTime: new Date(),
  };
  let tagRepo: jest.Mocked<
    Pick<
      Repository<TagEntity>,
      'existsBy' | 'find' | 'findOne' | 'create' | 'save' | 'update'
    >
  > & { manager: { transaction: jest.Mock } };
  let userRepo: { findOne: jest.Mock };
  let manager: { getRepository: jest.Mock };
  let service: TagsService;

  beforeEach(() => {
    tagRepo = {
      existsBy: jest.fn().mockResolvedValue(false),
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockReturnValue(tag),
      save: jest.fn().mockResolvedValue(tag),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      manager: {
        transaction: jest.fn(
          async (
            _isolation: string,
            action: (manager: EntityManager) => Promise<unknown>,
          ) => action(manager as unknown as EntityManager),
        ),
      },
    };
    userRepo = { findOne: jest.fn().mockResolvedValue({ id: 7 }) };
    manager = {
      getRepository: jest.fn((entity: unknown) =>
        entity === UserEntity ? userRepo : tagRepo,
      ),
    };
    service = new TagsService(tagRepo as unknown as Repository<TagEntity>);
  });

  it('只返回当前用户的未归档标签公开字段', async () => {
    tagRepo.find.mockResolvedValue([tag]);

    await expect(service.findAllByUser(7)).resolves.toEqual([
      { id: 1, name: '出差', archived: false },
    ]);
    const findOptions = tagRepo.find.mock.calls[0][0];
    expect(findOptions?.select).toEqual({
      id: true,
      name: true,
      archivedTime: true,
      updatedTime: true,
    });
    expect(findOptions?.where).toEqual(
      expect.objectContaining({ ownerUserId: 7 }),
    );
    expect(findOptions?.where).toHaveProperty('archivedTime');
    expect(findOptions?.order).toEqual({ updatedTime: 'DESC', id: 'DESC' });
  });

  it('账单筛选请求已归档标签时返回全部标签且未归档优先', async () => {
    const archivedTag: TagEntity = {
      ...tag,
      id: 2,
      name: '旧项目',
      archivedTime: new Date('2026-09-30T12:00:00+08:00'),
      updatedTime: new Date('2026-09-30T12:00:00+08:00'),
    };
    const activeTag: TagEntity = {
      ...tag,
      updatedTime: new Date('2026-09-29T12:00:00+08:00'),
    };
    tagRepo.find.mockResolvedValue([archivedTag, activeTag]);

    await expect(service.findAllByUser(7, true)).resolves.toEqual([
      { id: 1, name: '出差', archived: false },
      { id: 2, name: '旧项目', archived: true },
    ]);

    const findOptions = tagRepo.find.mock.calls[0][0];
    expect(findOptions?.where).toEqual({ ownerUserId: 7 });
    expect(findOptions?.where).not.toHaveProperty('archivedTime');
  });

  it('创建标签时写入当前用户归属', async () => {
    await service.create(7, '出差');

    expect(tagRepo.existsBy).toHaveBeenCalledWith(
      expect.objectContaining({ ownerUserId: 7, name: '出差' }),
    );
    expect(tagRepo.create).toHaveBeenCalledWith({
      ownerUserId: 7,
      name: '出差',
    });
    expect(tagRepo.save).toHaveBeenCalledWith(tag);
  });

  it('编辑标签时排除自身并检查同名标签', async () => {
    tagRepo.existsBy.mockResolvedValueOnce(true).mockResolvedValueOnce(false);

    await service.update(1, 7, '差旅');

    expect(tagRepo.existsBy).toHaveBeenCalledTimes(2);
    expect(tagRepo.existsBy.mock.calls[1][0]).toEqual(
      expect.objectContaining({
        ownerUserId: 7,
        name: '差旅',
      }),
    );
    expect(tagRepo.existsBy.mock.calls[1][0]).toHaveProperty('id');
    expect(tagRepo.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: 1, ownerUserId: 7 }),
      { name: '差旅' },
    );
    expect(tagRepo.update.mock.calls[0][0]).toHaveProperty('archivedTime');
  });

  it('拒绝把标签编辑为其他未归档标签的同名名称', async () => {
    tagRepo.existsBy.mockResolvedValueOnce(true).mockResolvedValueOnce(true);

    await expect(service.update(1, 7, '出差')).rejects.toThrow(
      BadRequestException,
    );
    expect(tagRepo.update).not.toHaveBeenCalled();
  });

  it('配置管理创建同名标签仍然拒绝，并且不执行写入', async () => {
    tagRepo.existsBy.mockResolvedValue(true);
    await expect(service.create(7, '出差')).rejects.toThrow('已经存在同名标签');
    expect(tagRepo.save).not.toHaveBeenCalled();
  });

  it('流水草稿检查同名标签只返回原id，不执行任何写入', async () => {
    tagRepo.findOne.mockResolvedValue(tag);
    await expect(service.checkName(7, '出差')).resolves.toEqual({
      id: 1,
      name: '出差',
      archived: false,
    });
    expect(tagRepo.findOne).toHaveBeenCalledWith({
      select: { id: true, name: true },
      where: { ownerUserId: 7, name: '出差', archivedTime: IsNull() },
    });
    expect(tagRepo.save).not.toHaveBeenCalled();
    expect(tagRepo.manager.transaction).not.toHaveBeenCalled();
  });

  it('流水草稿检查新名称返回null，不创建未保存的标签', async () => {
    await expect(service.checkName(7, '出差')).resolves.toBeNull();
    expect(tagRepo.create).not.toHaveBeenCalled();
    expect(tagRepo.save).not.toHaveBeenCalled();
  });

  it.each(['create', 'update'] as const)(
    '%s在当前用户排他锁后校验名称',
    async (action) => {
      if (action === 'update') {
        tagRepo.existsBy
          .mockResolvedValueOnce(true)
          .mockResolvedValueOnce(false);
        await service.update(1, 7, '出差');
      } else {
        await service[action](7, '出差');
      }
      expect(tagRepo.manager.transaction).toHaveBeenCalledWith(
        'READ COMMITTED',
        expect.any(Function),
      );
      expect(userRepo.findOne).toHaveBeenCalledWith({
        select: { id: true },
        where: { id: 7 },
        lock: { mode: 'pessimistic_write' },
      });
      const firstNameQuery = tagRepo.existsBy;
      expect(userRepo.findOne.mock.invocationCallOrder[0]).toBeLessThan(
        firstNameQuery.mock.invocationCallOrder[0],
      );
    },
  );

  it('用户不存在时不读取或创建标签，数据库写入失败时不返回假成功', async () => {
    userRepo.findOne.mockResolvedValueOnce(null);
    await expect(service.create(7, '出差')).rejects.toThrow('用户不存在');
    expect(tagRepo.findOne).not.toHaveBeenCalled();
    tagRepo.save.mockRejectedValueOnce(new Error('写入失败'));
    await expect(service.create(7, '出差')).rejects.toThrow(
      '创建标签失败，请重新尝试',
    );
  });

  it('归档更新未命中目标时返回明确失败', async () => {
    tagRepo.existsBy.mockResolvedValue(true);
    tagRepo.update.mockResolvedValue({ affected: 0 });

    await expect(service.archive(1, 7)).rejects.toThrow(
      InternalServerErrorException,
    );
  });
});
