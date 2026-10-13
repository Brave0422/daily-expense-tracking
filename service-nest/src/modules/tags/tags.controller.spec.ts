/**
 * @author Brave
 * @date 2026-10-13T16:37:14+08:00
 * @description 标签草稿只读查重接口测试，验证认证归属、名称标准化和长度校验。
 */

import { ValidationPipe } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import type { NextFunction, Response } from 'express';
import type { Server } from 'node:http';
import request from 'supertest';
import { ResponseInterceptor } from '../../common/interceptors/response.interceptor';
import type { RequestWithOptionalUser } from '../auth/types/authenticated-request.type';
import { TagsController } from './tags.controller';
import { TagsService } from './tags.service';

jest.mock('./tags.service', () => ({ TagsService: class TagsService {} }));

describe('GET /tags/check-name', () => {
  let app: INestApplication<Server>;
  const checkName = jest.fn();

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [TagsController],
      providers: [{ provide: TagsService, useValue: { checkName } }],
    }).compile();
    app = module.createNestApplication<INestApplication<Server>>();
    app.use(
      (req: RequestWithOptionalUser, _res: Response, next: NextFunction) => {
        if (req.headers['x-test-auth'])
          req.user = { userId: 7, sessionId: 'test-session' };
        next();
      },
    );
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        stopAtFirstError: true,
      }),
    );
    app.useGlobalInterceptors(new ResponseInterceptor(app.get(Reflector)));
    await app.init();
  });
  beforeEach(() => {
    checkName
      .mockReset()
      .mockResolvedValue({ id: 8, name: '去新西兰旅游', archived: false });
  });
  afterAll(async () => {
    await app.close();
  });

  it('标准化输入并只使用认证上下文的用户id，返回可绑定的标签', async () => {
    const result = await request(app.getHttpServer())
      .get('/tags/check-name')
      .set('x-test-auth', '1')
      .query({ name: ' 去新西兰旅游 ', userId: 999 })
      .expect(200);
    expect(checkName).toHaveBeenCalledWith(7, '去新西兰旅游');
    const responseBody: unknown = result.body;
    expect(responseBody).toMatchObject({
      data: { id: 8, name: '去新西兰旅游', archived: false },
    });
  });
  it.each([
    {},
    { name: '   ' },
    { name: '中'.repeat(51) },
    { name: '😀'.repeat(51) },
  ])('拒绝非法名称 %j', async (body) => {
    await request(app.getHttpServer())
      .get('/tags/check-name')
      .set('x-test-auth', '1')
      .query(body)
      .expect(400);
    expect(checkName).not.toHaveBeenCalled();
  });
  it('接受50个Unicode字符，未登录时拒绝查询', async () => {
    await request(app.getHttpServer())
      .get('/tags/check-name')
      .set('x-test-auth', '1')
      .query({ name: '😀'.repeat(50) })
      .expect(200);
    expect(checkName).toHaveBeenCalledWith(7, '😀'.repeat(50));
    checkName.mockClear();
    await request(app.getHttpServer())
      .get('/tags/check-name')
      .query({ name: '旅行' })
      .expect(401);
    expect(checkName).not.toHaveBeenCalled();
  });
});
