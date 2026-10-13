/**
 * @author Brave
 * @date 2026-10-12T22:12:39+08:00
 * @description 流水写入 HTTP 测试，验证认证用户传递、DTO 边界及统一响应和业务错误。
 */

import {
  BadRequestException,
  INestApplication,
  InternalServerErrorException,
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

describe('TransactionsController', () => {
  let app: INestApplication<App>;
  const createTransaction = jest.fn<Promise<void>, unknown[]>();
  const updateTransaction = jest.fn<Promise<void>, unknown[]>();
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
        {
          provide: TransactionsService,
          useValue: { createTransaction, updateTransaction },
        },
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
  beforeEach(() => {
    createTransaction.mockReset().mockResolvedValue(undefined);
    updateTransaction.mockReset().mockResolvedValue(undefined);
  });
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
      undefined,
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

  it.each(['create', 'update'])(
    '%s转发规范化的新标签草稿名称',
    async (operation) => {
      const req = request(app.getHttpServer());
      await (
        operation === 'create'
          ? req.post('/transactions')
          : req.patch('/transactions/101')
      )
        .set('Authorization', 'Bearer test-user')
        .send({
          ...body,
          type: operation === 'update' ? undefined : body.type,
          tagNames: [' 新西兰旅行 '],
        })
        .expect(200);
      const calls =
        operation === 'create'
          ? createTransaction.mock.calls
          : updateTransaction.mock.calls;
      expect(calls[0]?.[8]).toEqual(['新西兰旅行']);
    },
  );

  it.each(['create', 'update'])(
    '%s拒绝非法的新标签名称数组',
    async (operation) => {
      for (const tagNames of [
        null,
        '旅行',
        [123],
        ['   '],
        ['😀'.repeat(51)],
      ]) {
        const req = request(app.getHttpServer());
        await (
          operation === 'create'
            ? req.post('/transactions')
            : req.patch('/transactions/101')
        )
          .set('Authorization', 'Bearer test-user')
          .send({
            ...body,
            type: operation === 'update' ? undefined : body.type,
            tagNames,
          })
          .expect(400);
      }
      expect(createTransaction).not.toHaveBeenCalled();
      expect(updateTransaction).not.toHaveBeenCalled();
    },
  );

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
      undefined,
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

  describe('PATCH /transactions/:id', () => {
    const updateBody = {
      categoryId: 12,
      amount: '17.28',
      occurredDate: '2026-10-13',
      title: ' 午餐 ',
      tagIds: [3, 5],
      remark: ' 优惠 ',
    };

    it('使用认证用户和路径id，转发六个可编辑字段并返回无数据成功响应', async () => {
      const response = await request(app.getHttpServer())
        .patch('/transactions/101')
        .set('Authorization', 'Bearer test-user')
        .send({ ...updateBody, userId: 999, ownerUserId: 999, id: 999 })
        .expect(200);

      expect(updateTransaction).toHaveBeenCalledWith(
        7,
        101,
        12,
        '17.28',
        '2026-10-13',
        '午餐',
        [3, 5],
        '优惠',
        undefined,
      );
      expect(response.body).toMatchObject({
        success: true,
        code: 200,
        msg: '编辑流水成功',
      });
      expect(response.body).not.toHaveProperty('data');
    });

    it('未认证时拒绝编辑', async () => {
      await request(app.getHttpServer())
        .patch('/transactions/101')
        .send(updateBody)
        .expect(401);
      expect(updateTransaction).not.toHaveBeenCalled();
    });

    it.each(['expense', 'income', null, ''])(
      '显式提交 type=%j 时拒绝请求',
      async (type) => {
        const response = await request(app.getHttpServer())
          .patch('/transactions/101')
          .set('Authorization', 'Bearer test-user')
          .send({ ...updateBody, type })
          .expect(400);
        expect(response.body).toHaveProperty('message', ['流水类型不允许修改']);
        expect(updateTransaction).not.toHaveBeenCalled();
      },
    );

    it.each(Object.keys(updateBody))(
      '省略可编辑字段 %s 时拒绝请求，避免意外清空数据',
      async (field) => {
        const incompleteBody: Record<string, unknown> = { ...updateBody };
        delete incompleteBody[field];
        await request(app.getHttpServer())
          .patch('/transactions/101')
          .set('Authorization', 'Bearer test-user')
          .send(incompleteBody)
          .expect(400);
        expect(updateTransaction).not.toHaveBeenCalled();
      },
    );

    it.each([
      'abc',
      '1.5',
      '1e2',
      '0',
      '-1',
      '9007199254740992',
      '9007199254740993',
      '%20101%20',
    ])('非法路径id %s 不进入业务层', async (id) => {
      await request(app.getHttpServer())
        .patch(`/transactions/${id}`)
        .set('Authorization', 'Bearer test-user')
        .send(updateBody)
        .expect(400);
      expect(updateTransaction).not.toHaveBeenCalled();
    });

    it.each([
      { categoryId: '12' },
      { categoryId: 0 },
      { categoryId: Number.MAX_SAFE_INTEGER + 1 },
      ...[
        '0',
        '-1',
        '1.001',
        '10000000000000',
        '1e2',
        '01.00',
        '1.00\n',
        1,
        null,
      ].map((amount) => ({ amount })),
      ...[
        '2026-02-29',
        '2026-04-31',
        '2026-10-13T12:00:00Z',
        '0999-12-31',
        null,
      ].map((occurredDate) => ({ occurredDate })),
      ...[null, '3', [0], [1.5], ['3'], [Number.MAX_SAFE_INTEGER + 1]].map(
        (tagIds) => ({ tagIds }),
      ),
      { title: 123 },
      { title: '😀'.repeat(51) },
      { remark: 123 },
      { remark: '中'.repeat(101) },
    ])('非法编辑字段在进入业务层前被拒绝：%j', async (invalid) => {
      await request(app.getHttpServer())
        .patch('/transactions/101')
        .set('Authorization', 'Bearer test-user')
        .send({ ...updateBody, ...invalid })
        .expect(400);
      expect(updateTransaction).not.toHaveBeenCalled();
    });

    it('允许清空文本和标签，接受合法闰日与最大精度金额', async () => {
      await request(app.getHttpServer())
        .patch('/transactions/101')
        .set('Authorization', 'Bearer test-user')
        .send({
          ...updateBody,
          amount: '9999999999999.99',
          occurredDate: '2024-02-29',
          title: null,
          tagIds: [],
          remark: '  ',
        })
        .expect(200);
      expect(updateTransaction).toHaveBeenCalledWith(
        7,
        101,
        12,
        '9999999999999.99',
        '2024-02-29',
        null,
        [],
        '',
        undefined,
      );
    });

    it('文本先去除首尾空格，Unicode 长度按字符校验', async () => {
      await request(app.getHttpServer())
        .patch('/transactions/101')
        .set('Authorization', 'Bearer test-user')
        .send({ ...updateBody, title: ` ${'😀'.repeat(50)} `, remark: null })
        .expect(200);
      expect(updateTransaction).toHaveBeenCalledWith(
        7,
        101,
        12,
        '17.28',
        '2026-10-13',
        '😀'.repeat(50),
        [3, 5],
        null,
        undefined,
      );
    });

    it.each([
      [new BadRequestException('流水记录不存在'), 400, '流水记录不存在'],
      [
        new BadRequestException('标签不存在或已归档'),
        400,
        '标签不存在或已归档',
      ],
      [
        new InternalServerErrorException('编辑流水失败，请重新尝试'),
        500,
        '编辑流水失败，请重新尝试',
      ],
    ] as const)('保留服务层错误：%s', async (error, status, message) => {
      updateTransaction.mockRejectedValueOnce(error);
      const response = await request(app.getHttpServer())
        .patch('/transactions/101')
        .set('Authorization', 'Bearer test-user')
        .send(updateBody)
        .expect(status);
      expect(response.body).toHaveProperty('message', message);
    });
  });
});
