/**
 * @author Brave
 * @date 2026-10-14T12:48:33+08:00
 * @description 六个统计接口的 HTTP 测试，覆盖认证、严格白名单、日期边界和 DTO 联动。
 */
import { type INestApplication, ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import type { NextFunction, Response } from 'express';
import request from 'supertest';
import type { App } from 'supertest/types';
import { ResponseInterceptor } from '../../common/interceptors/response.interceptor';
import type { RequestWithOptionalUser } from '../auth/types/authenticated-request.type';
import { StatisticsController } from './statistics.controller';
import { StatisticsService } from './statistics.service';
jest.mock('./statistics.service', () => ({ StatisticsService: class {} }));

const cases = [
  [
    'category-ranking/monthly',
    'findMonthlyCategoryRanking',
    { month: '2026-10', type: 'expense', categoryLevel: '2', order: 'desc' },
    [7, '2026-10', 'expense', 2, 'desc'],
  ],
  [
    'category-ranking/yearly',
    'findYearlyCategoryRanking',
    { year: '2026', type: 'expense', categoryLevel: '1', order: 'asc' },
    [7, '2026', 'expense', 1, 'asc'],
  ],
  [
    'category-proportion/monthly',
    'findMonthlyCategoryProportion',
    { month: '2026-10', type: 'income', categoryLevel: '1' },
    [7, '2026-10', 'income', 1],
  ],
  [
    'category-proportion/yearly',
    'findYearlyCategoryProportion',
    { year: '2026', type: 'expense', categoryLevel: '2' },
    [7, '2026', 'expense', 2],
  ],
  [
    'transaction-trend/monthly',
    'findMonthlyTransactionTrend',
    { month: '2026-10', type: 'expense' },
    [7, '2026-10', 'expense'],
  ],
  [
    'transaction-trend/yearly',
    'findYearlyTransactionTrend',
    { year: '2026', type: 'income' },
    [7, '2026', 'income'],
  ],
] as const;

describe('StatisticsController HTTP', () => {
  let app: INestApplication<App>;
  const service = Object.fromEntries(
    cases.map(([, method]) => [
      method,
      jest.fn().mockResolvedValue({ totalAmount: '0.00', items: [] }),
    ]),
  );
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [StatisticsController],
      providers: [{ provide: StatisticsService, useValue: service }],
    }).compile();
    app = module.createNestApplication();
    app.use(
      (req: RequestWithOptionalUser, _res: Response, next: NextFunction) => {
        if (req.headers.authorization === 'Bearer test-user')
          req.user = { userId: 7, sessionId: 'test-session' };
        next();
      },
    );
    // 与 main.ts 相同的宽松全局白名单；统计专用管道仍须拒绝原始多余字段。
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: false,
      }),
    );
    app.useGlobalInterceptors(new ResponseInterceptor(new Reflector()));
    await app.init();
  });
  beforeEach(() => jest.clearAllMocks());
  afterAll(async () => {
    await app.close();
  });
  it.each(cases)(
    '%s 使用认证用户、独立 DTO 和单层响应',
    async (path, method, query, args) => {
      const response = await request(app.getHttpServer())
        .get(`/statistics/${path}`)
        .set('Authorization', 'Bearer test-user')
        .query(query)
        .expect(200);
      expect(service[method]).toHaveBeenCalledWith(...args);
      expect(response.body).toMatchObject({
        success: true,
        data: { totalAmount: '0.00', items: [] },
      });
      expect(response.body).not.toHaveProperty('data.data');
    },
  );
  it.each(cases)('%s 未认证时拒绝访问', async (path, method, query) => {
    await request(app.getHttpServer())
      .get(`/statistics/${path}`)
      .query(query)
      .expect(401);
    expect(service[method]).not.toHaveBeenCalled();
  });
  it.each(cases)(
    '%s 拒绝所有额外字段及必填缺失',
    async (path, method, query) => {
      for (const key of [
        'userId',
        'categoryId',
        'tagIds',
        'title',
        'remark',
        'page',
        'minAmount',
        'startDate',
        ...('year' in query ? ['month'] : ['year']),
        ...(!('categoryLevel' in query) ? ['categoryLevel'] : []),
        ...(!('order' in query) ? ['order'] : []),
      ]) {
        await request(app.getHttpServer())
          .get(`/statistics/${path}`)
          .set('Authorization', 'Bearer test-user')
          .query({ ...query, [key]: '' })
          .expect(400);
      }
      for (const key of Object.keys(query)) {
        const incomplete: Record<string, string> = { ...query };
        delete incomplete[key];
        await request(app.getHttpServer())
          .get(`/statistics/${path}`)
          .set('Authorization', 'Bearer test-user')
          .query(incomplete)
          .expect(400);
      }
      expect(service[method]).not.toHaveBeenCalled();
    },
  );
  it.each([
    { type: 'all' },
    { type: ['expense', 'income'] },
    { type: '' },
    { categoryLevel: '01' },
    { categoryLevel: '1.0' },
    { categoryLevel: '1e0' },
    { categoryLevel: ' 1' },
    { categoryLevel: '' },
    { categoryLevel: ['1', '2'] },
    { month: '2026-1' },
    { month: '2026-00' },
    { month: '2026-13' },
    { month: '0000-10' },
    { month: '0999-12' },
    { month: '1000-01' },
    { month: '9999-12' },
    { month: '2026-10\n' },
    { month: ['2026-10', '2026-11'] },
    { order: 'DESC' },
    { order: ['asc', 'desc'] },
    { order: '' },
  ])('月排行拒绝非法输入 %j', async (invalid) => {
    await request(app.getHttpServer())
      .get('/statistics/category-ranking/monthly')
      .set('Authorization', 'Bearer test-user')
      .query({ ...cases[0][2], ...invalid })
      .expect(400);
    expect(service.findMonthlyCategoryRanking).not.toHaveBeenCalled();
  });
  it.each([
    '0000',
    '0999',
    '1000',
    '9999',
    '2026-10',
    '26',
    '2026\n',
    '',
    ['2025', '2026'],
  ])('年趋势拒绝非法年份 %j', async (year) => {
    await request(app.getHttpServer())
      .get('/statistics/transaction-trend/yearly')
      .set('Authorization', 'Bearer test-user')
      .query({ year, type: 'income' })
      .expect(400);
  });
  it('收入二级分类提示明确，不静默转换', async () => {
    const response = await request(app.getHttpServer())
      .get('/statistics/category-proportion/monthly')
      .set('Authorization', 'Bearer test-user')
      .query({ month: '2026-10', type: 'income', categoryLevel: '2' })
      .expect(400);
    expect(response.body).toHaveProperty(
      'message',
      expect.arrayContaining(['收入只支持一级分类统计']),
    );
  });
});
