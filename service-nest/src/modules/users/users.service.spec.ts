/**
 * @author Brave
 * @date 2026-09-27T11:26:12+08:00
 * @description 用户服务单元测试，验证公共用户查询与存在性检查。
 */

import { BadRequestException } from '@nestjs/common';
import type { Repository } from 'typeorm';
import type { UserEntity } from './entities/user.entity';
import { UsersService } from './users.service';

jest.mock('@nestjs/typeorm', () => ({
  InjectRepository: () => () => undefined,
}));

describe('UsersService', () => {
  const user: UserEntity = {
    id: 7,
    email: 'test@example.com',
    passwordHash: 'password-hash',
    createdTime: new Date(),
    updateTime: new Date(),
  };
  let userRepo: jest.Mocked<
    Pick<Repository<UserEntity>, 'findOneBy' | 'existsBy'>
  >;
  let service: UsersService;

  beforeEach(() => {
    userRepo = {
      findOneBy: jest.fn(),
      existsBy: jest.fn(),
    };
    service = new UsersService(userRepo as unknown as Repository<UserEntity>);
  });

  it('返回存在的用户', async () => {
    userRepo.findOneBy.mockResolvedValue(user);

    await expect(service.findOneByIdOrThrow(7)).resolves.toBe(user);
    expect(userRepo.findOneBy).toHaveBeenCalledWith({ id: 7 });
  });

  it('用户不存在时抛出统一异常', async () => {
    userRepo.findOneBy.mockResolvedValue(null);

    await expect(service.findOneByIdOrThrow(7)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('仅查询用户存在性', async () => {
    userRepo.existsBy.mockResolvedValue(true);

    await expect(service.existsById(7)).resolves.toBe(true);
    expect(userRepo.existsBy).toHaveBeenCalledWith({ id: 7 });
  });
});
