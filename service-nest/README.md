<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Naming conventions

- Database tables, resource module directories, resource Module/Controller/Service classes, and REST resource paths use plural names, such as `transactions`, `TagsService`, and `/verification-codes`.
- Entity classes and entity filenames represent one record and use singular names, such as `TransactionEntity` and `transaction.entity.ts`.
- Single-value properties and foreign-key columns use singular names, such as `transactionId` and `transaction_id`; arrays and collection relations use plural names, such as `tagIds` and `tags`.
- Capability modules that do not represent resource collections keep singular names, such as `auth` and `mail`.

## Database initialization

两个脚本默认使用 `daily-expense-tracking` 数据库，与当前 `.env.development` 中的 `DB_DATABASE` 一致。`init.sql` 会创建并选择该数据库，`mock-data.sql` 也会显式选择该数据库。在 MySQL 8.0 客户端中依次执行：

```sql
-- 创建项目数据库和全部 9 张表，并初始化 111 个分类图标和 83 个默认分类模板。
SOURCE sql/init.sql;

-- 可选：添加开发用假数据。
SOURCE sql/mock-data.sql;
```

上面的路径相对于 `service-nest` 目录；也可以在数据库工具中按顺序打开并执行两个脚本。如果 `DB_DATABASE` 使用其他名称，需要同步修改两个 SQL 文件中的数据库名。`init.sql` 与当前 TypeORM 实体保持一致，使用 `IF NOT EXISTS` 建表，不清空已有数据；已有旧表结构需单独迁移。

遇到 `Unknown column 'password_hash'` 时，检查执行所在的数据库。其他数据库可能已有同名的 `users` 表，但列名和本项目不同，`IF NOT EXISTS` 不会修改这些已有表。使用更新后的两个脚本可自动选择项目数据库；如果之前在同一连接中执行失败，先执行 `ROLLBACK;`，再重新运行脚本。

`mock-data.sql` 默认创建账号 `demo@example.com`，密码为 `Demo123456`，并添加该用户的全部 83 个默认分类、50 个标签、150 条最近 90 天内的流水（120 条支出、30 条收入）及 300 条流水标签关联。会话和验证码表各添加 1 条已失效的示例记录。所有业务 ID 均由数据库生成，分类父子关系使用真实用户分类 ID。

两个脚本可重复执行：基础图标和模板按主键更新，假数据只补充缺失的示例记录。假数据账号已存在时会复用该用户，保留其密码及已有数据；需要另一套假数据时，可修改 `mock-data.sql` 中的 `@mock_email`。

## Project setup

```bash
$ npm install
```

## Compile and run the project

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Run tests

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ npm install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).
