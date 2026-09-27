/**
 * @author Brave
 * @date 2026-09-27T13:10:03+08:00
 * @description 标签服务单元测试，验证用户隔离、归档过滤和名称唯一性。
 */

import {
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import type { Repository } from 'typeorm';
import { TagEntity } from './entities/tag.entity';
import { TagsService } from './tags.service';

jest.mock('@nestjs/typeorm', () => ({
  InjectRepository: () => () => undefined,
}));

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
      'existsBy' | 'find' | 'create' | 'save' | 'update'
    >
  >;
  let service: TagsService;

  beforeEach(() => {
    tagRepo = {
      existsBy: jest.fn().mockResolvedValue(false),
      find: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockReturnValue(tag),
      save: jest.fn().mockResolvedValue(tag),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    service = new TagsService(tagRepo as unknown as Repository<TagEntity>);
  });

  it('只返回当前用户的未归档标签公开字段', async () => {
    tagRepo.find.mockResolvedValue([tag]);

    await expect(service.findAllByUser(7)).resolves.toEqual([tag]);
    const findOptions = tagRepo.find.mock.calls[0][0];
    expect(findOptions?.select).toEqual({ id: true, name: true });
    expect(findOptions?.where).toEqual(
      expect.objectContaining({ ownerUserId: 7 }),
    );
    expect(findOptions?.where).toHaveProperty('archivedTime');
    expect(findOptions?.order).toEqual({ updatedTime: 'DESC', id: 'DESC' });
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

  it('归档更新未命中目标时返回明确失败', async () => {
    tagRepo.existsBy.mockResolvedValue(true);
    tagRepo.update.mockResolvedValue({ affected: 0 });

    await expect(service.archive(1, 7)).rejects.toThrow(
      InternalServerErrorException,
    );
  });
});
