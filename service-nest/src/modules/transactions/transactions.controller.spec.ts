/**
 * @author Brave
 * @date 2026-10-12T22:12:39+08:00
 * @description 创建流水 HTTP 测试，验证认证用户传递、DTO 边界及统一响应和业务错误。
 */

import {
  BadRequestException,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import type { NextFunction, Response } from 'express';
import request from 'supertest';
import type { App } from 'supertest/types';
import { ResponseInterceptor } from '../../common/interceptors/response.interceptor';
import type { RequestWithOptionalUser } from '../auth/types/authenticated-request.type';
import { TransactionsController } from './transactions.controller';
import { TransactionsService } from './transactions.service';

// 此处测试 HTTP 边界；真实事务写入由 transactions.create.spec.ts 覆盖。
jest.mock('./transactions.service', () => ({ TransactionsService: class {} }));

describe('TransactionsController POST /transactions', () => {
  let app: INestApplication<App>;
  const createTransaction = jest.fn<Promise<void>, unknown[]>();
  const body = {
    type: 'expense',
    categoryId: 12,
    amount: '17.28',
    occurredDate: '2026-10-12',
    title: ' 午餐 ',
    tagIds: [3, 5],
    remark: ' 优惠 ',
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [TransactionsController],
      providers: [
        { provide: TransactionsService, useValue: { createTransaction } },
      ],
    }).compile();
    app = module.createNestApplication();
    app.use(
      (req: RequestWithOptionalUser, _res: Response, next: NextFunction) => {
        if (req.headers.authorization === 'Bearer test-user') {
          req.user = { userId: 7, sessionId: 'test-session' };
        }
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
    app.useGlobalInterceptors(new ResponseInterceptor(new Reflector()));
    await app.init();
  });
  beforeEach(() => createTransaction.mockReset().mockResolvedValue(undefined));
  afterAll(async () => {
    await app.close();
  });

  it('使用认证用户，忽略伪造归属字段，转发完整参数并返回无流水数据的成功响应', async () => {
    const response = await request(app.getHttpServer())
      .post('/transactions')
      .set('Authorization', 'Bearer test-user')
      .send({ ...body, userId: 999, ownerUserId: 999, id: 99 })
      .expect(200);
    expect(createTransaction).toHaveBeenCalledWith(
      7,
      'expense',
      12,
      '17.28',
      '2026-10-12',
      '午餐',
      [3, 5],
      '优惠',
    );
    expect(response.body).toMatchObject({
      success: true,
      code: 200,
      msg: '创建流水成功',
    });
    expect(response.body).not.toHaveProperty('data');
  });

  it('未认证时拒绝创建', async () => {
    await request(app.getHttpServer())
      .post('/transactions')
      .send(body)
      .expect(401);
    expect(createTransaction).not.toHaveBeenCalled();
  });

  it.each([
    { type: 'all' },
    { categoryId: '12' },
    { categoryId: 0 },
    { categoryId: Number.MAX_SAFE_INTEGER + 1 },
    ...[
      '0',
      '0.00',
      '-1.00',
      '1.001',
      '10000000000000',
      '1e2',
      'NaN',
      '01.00',
      ' 1.00 ',
      '1.00\n',
      '',
      1,
      null,
    ].map((amount) => ({ amount })),
    ...[
      '2026-02-29',
      '2026-02-30',
      '2026-04-31',
      '2026-13-01',
      '2026-10-00',
      '2026-1-01',
      '2026-10-11T12:00:00Z',
      '0000-01-01',
      '0999-12-31',
      '',
      null,
    ].map((occurredDate) => ({ occurredDate })),
    ...[[0], [-1], [1.5], ['3'], null, '3'].map((tagIds) => ({ tagIds })),
    { title: '😀'.repeat(51) },
    { remark: '中'.repeat(101) },
    { title: 123 },
    { remark: 123 },
  ])('无效请求在进入业务层之前拒绝：%j', async (invalid) => {
    await request(app.getHttpServer())
      .post('/transactions')
      .set('Authorization', 'Bearer test-user')
      .send({ ...body, ...invalid })
      .expect(400);
    expect(createTransaction).not.toHaveBeenCalled();
  });

  it('支持收入、合法闰日、最大精度金额和省略可选字段', async () => {
    await request(app.getHttpServer())
      .post('/transactions')
      .set('Authorization', 'Bearer test-user')
      .send({
        type: 'income',
        categoryId: 6,
        amount: '9999999999999.99',
        occurredDate: '2024-02-29',
      })
      .expect(200);
    expect(createTransaction).toHaveBeenCalledWith(
      7,
      'income',
      6,
      '9999999999999.99',
      '2024-02-29',
      undefined,
      undefined,
      undefined,
    );
  });

  it('空文本及 NULL 可选文本有效，Unicode 长度按字符计算', async () => {
    await request(app.getHttpServer())
      .post('/transactions')
      .set('Authorization', 'Bearer test-user')
      .send({
        ...body,
        title: ` ${'😀'.repeat(50)} `,
        remark: null,
        tagIds: [],
      })
      .expect(200);
    expect(createTransaction).toHaveBeenLastCalledWith(
      7,
      'expense',
      12,
      '17.28',
      '2026-10-12',
      '😀'.repeat(50),
      [],
      null,
    );
  });

  it('保留服务层的分类或标签校验错误', async () => {
    createTransaction.mockRejectedValueOnce(
      new BadRequestException('分类不存在或已归档'),
    );
    const response = await request(app.getHttpServer())
      .post('/transactions')
      .set('Authorization', 'Bearer test-user')
      .send(body)
      .expect(400);
    expect(response.body).toMatchObject({ message: '分类不存在或已归档' });
  });
});
