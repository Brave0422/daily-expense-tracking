-- 建立流水、标签、流水标签关联三张表，并直接插入测试数据。
-- users、user_categories 使用已有表；下方id已按当前开发库的用户3配置。
-- 分类id必须是该用户的用户分类id，不是分类模板id。
-- 流水100条：支出80条、收入20条，其中3条已归档；标签8个、关联105条。
-- 日期列沿用当前实体的 occurred；此脚本用于一次性导入。

-- 更新时间使用数据库默认值，无需在 INSERT 中指定更新时间列。

USE daily_expense_tracking;
SET NAMES utf8mb4;

SET @user_id := 3;
SET @expense_category_id := 21; -- 用户3的支出二级分类：早餐
SET @income_category_id := 2;   -- 用户3的收入一级分类：工资

-- 流水id为100001～100100，标签id为100001～100008；如已占用，调整这两个基数。
SET @transaction_id_base := 100000;
SET @tag_id_base := 100000;

CREATE TABLE IF NOT EXISTS tags (
  id INT NOT NULL AUTO_INCREMENT,
  owner_user_id INT NOT NULL,
  name VARCHAR(50) NOT NULL,
  archived_time DATETIME NULL,
  created_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_tags_owner_archived_name (owner_user_id, archived_time, name),
  CONSTRAINT fk_tags_owner_user FOREIGN KEY (owner_user_id)
    REFERENCES users (id) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS transactions (
  id INT NOT NULL AUTO_INCREMENT,
  owner_user_id INT NOT NULL,
  type VARCHAR(20) NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  category_id INT NOT NULL,
  title VARCHAR(50) NULL,
  remark VARCHAR(100) NULL,
  occurred DATE NOT NULL COMMENT '实际发生日期，对应当前实体 occurredDate',
  archived_time DATETIME NULL,
  created_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_transactions_owner_type_archived_occurred_id
    (owner_user_id, type, archived_time, occurred, id),
  INDEX idx_transactions_owner_archived_occurred_id
    (owner_user_id, archived_time, occurred, id),
  INDEX idx_transactions_category (category_id),
  CONSTRAINT chk_transactions_type CHECK (type IN ('expense', 'income')),
  CONSTRAINT chk_transactions_amount CHECK (amount > 0),
  CONSTRAINT fk_transactions_owner_user FOREIGN KEY (owner_user_id)
    REFERENCES users (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_transactions_category FOREIGN KEY (category_id)
    REFERENCES user_categories (id) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS transaction_tags (
  transaction_id INT NOT NULL,
  tag_id INT NOT NULL,
  PRIMARY KEY (transaction_id, tag_id),
  INDEX idx_transaction_tags_tag_transaction (tag_id, transaction_id),
  CONSTRAINT fk_transaction_tags_transaction FOREIGN KEY (transaction_id)
    REFERENCES transactions (id) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT fk_transaction_tags_tag FOREIGN KEY (tag_id)
    REFERENCES tags (id) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

START TRANSACTION;

INSERT INTO tags
  (id, owner_user_id, name, archived_time, created_time)
VALUES
  (@tag_id_base + 1, @user_id, '实操-日常', NULL, '2025-12-01 08:00:00'),
  (@tag_id_base + 2, @user_id, '实操-通勤', NULL, '2025-12-01 08:00:00'),
  (@tag_id_base + 3, @user_id, '实操-办公', NULL, '2025-12-01 08:00:00'),
  (@tag_id_base + 4, @user_id, '实操-学习', NULL, '2025-12-01 08:00:00'),
  (@tag_id_base + 5, @user_id, '实操-线上消费', NULL, '2025-12-01 08:00:00'),
  (@tag_id_base + 6, @user_id, '实操-家庭', NULL, '2025-12-01 08:00:00'),
  (@tag_id_base + 7, @user_id, '实操-报销', NULL, '2025-12-01 08:00:00'),
  (@tag_id_base + 8, @user_id, '实操-历史标签', '2026-10-08 10:00:00', '2025-12-01 08:00:00');

INSERT INTO transactions
  (id, owner_user_id, type, amount, category_id, title, remark, occurred,
   archived_time, created_time)
VALUES
  (@transaction_id_base + 1, @user_id, 'expense', 8.50, @expense_category_id, '早餐优惠100%原价对照', '流水查询实操样例', '2025-12-22', NULL, '2026-10-08 08:00:00'),
  (@transaction_id_base + 2, @user_id, 'expense', 26.00, @expense_category_id, 'A_B套餐实付', '流水查询实操样例', '2025-12-23', NULL, '2026-10-08 08:01:00'),
  (@transaction_id_base + 3, @user_id, 'expense', 38.80, @expense_category_id, '晚餐套餐', '流水查询实操样例', '2025-12-24', NULL, '2026-10-08 08:01:00'),
  (@transaction_id_base + 4, @user_id, 'expense', 76.35, @expense_category_id, '周末买菜食材', NULL, '2025-12-25', NULL, '2026-10-08 08:02:00'),
  (@transaction_id_base + 5, @user_id, 'income', 12800.00, @income_category_id, '工资到账', '流水查询实操样例', '2025-12-26', NULL, '2026-10-08 08:02:00'),
  (@transaction_id_base + 6, @user_id, 'expense', 32.90, @expense_category_id, '苹果和香蕉', '活动优惠10%，订单编号ORDER_2026', '2025-12-27', NULL, '2026-10-08 08:03:00'),
  (@transaction_id_base + 7, @user_id, 'expense', 15.20, @expense_category_id, '超市零食', '历史补录，发生日期早于录入日期', '2025-12-28', NULL, '2026-10-08 08:03:00'),
  (@transaction_id_base + 8, @user_id, 'expense', 18.00, @expense_category_id, '下午咖啡', NULL, '2025-12-29', NULL, '2026-10-08 08:04:00'),
  (@transaction_id_base + 9, @user_id, 'expense', 45.00, @expense_category_id, '周末电影票', '流水查询实操样例', '2025-12-30', NULL, '2026-10-08 08:04:00'),
  (@transaction_id_base + 10, @user_id, 'income', 3500.00, @income_category_id, '项目奖金', '流水查询实操样例', '2025-12-31', NULL, '2026-10-08 08:05:00'),
  (@transaction_id_base + 11, @user_id, 'expense', 29.90, @expense_category_id, NULL, '流水查询实操样例', '2026-01-01', NULL, '2026-10-08 08:05:00'),
  (@transaction_id_base + 12, @user_id, 'expense', 159.00, @expense_category_id, '换季上衣', NULL, '2026-01-02', NULL, '2026-10-08 08:06:00'),
  (@transaction_id_base + 13, @user_id, 'expense', 2800.00, @expense_category_id, '当月房租', '流水查询实操样例', '2026-01-03', NULL, '2026-10-08 08:06:00'),
  (@transaction_id_base + 14, @user_id, 'expense', 93.46, @expense_category_id, '家庭电费', '历史补录，发生日期早于录入日期', '2026-01-04', NULL, '2026-10-08 08:07:00'),
  (@transaction_id_base + 15, @user_id, 'income', 950.00, @income_category_id, '兼职开发收入', '流水查询实操样例', '2026-01-05', NULL, '2026-10-08 08:07:00'),
  (@transaction_id_base + 16, @user_id, 'expense', 1299.00, @expense_category_id, '办公显示器', NULL, '2026-01-06', NULL, '2026-10-08 08:08:00'),
  (@transaction_id_base + 17, @user_id, 'expense', 89.90, @expense_category_id, '键盘和数码配件', '流水查询实操样例', '2026-01-07', NULL, '2026-10-08 08:08:00'),
  (@transaction_id_base + 18, @user_id, 'expense', 6.00, @expense_category_id, '公交地铁充值', '活动优惠10%，订单编号ORDER_2026', '2026-01-08', NULL, '2026-10-08 08:09:00'),
  (@transaction_id_base + 19, @user_id, 'expense', 24.80, @expense_category_id, '下雨天打车', '流水查询实操样例', '2026-01-09', NULL, '2026-10-08 08:09:00'),
  (@transaction_id_base + 20, @user_id, 'income', 68.35, @income_category_id, '投资收益到账', NULL, '2026-01-10', NULL, '2026-10-08 08:10:00'),
  (@transaction_id_base + 21, @user_id, 'expense', 59.00, @expense_category_id, '手机话费充值', '历史补录，发生日期早于录入日期', '2026-03-01', NULL, '2026-10-08 08:10:00'),
  (@transaction_id_base + 22, @user_id, 'expense', 78.00, @expense_category_id, NULL, '流水查询实操样例', '2026-03-02', NULL, '2026-10-08 08:11:00'),
  (@transaction_id_base + 23, @user_id, 'expense', 399.00, @expense_category_id, '在线课程', '流水查询实操样例', '2026-03-03', NULL, '2026-10-08 08:11:00'),
  (@transaction_id_base + 24, @user_id, 'expense', 29.00, @expense_category_id, '软件月度订阅', NULL, '2026-03-04', NULL, '2026-10-08 08:12:00'),
  (@transaction_id_base + 25, @user_id, 'income', 260.00, @income_category_id, '闲置物品出售', '流水查询实操样例', '2026-03-05', NULL, '2026-10-08 08:12:00'),
  (@transaction_id_base + 26, @user_id, 'expense', 8.67, @expense_category_id, '早餐豆浆和包子', '流水查询实操样例', '2026-03-06', NULL, '2026-10-08 08:13:00'),
  (@transaction_id_base + 27, @user_id, 'expense', 26.17, @expense_category_id, '工作日午餐', '流水查询实操样例', '2026-03-07', NULL, '2026-10-08 08:13:00'),
  (@transaction_id_base + 28, @user_id, 'expense', 38.97, @expense_category_id, '晚餐套餐', NULL, '2026-03-08', NULL, '2026-10-08 08:14:00'),
  (@transaction_id_base + 29, @user_id, 'expense', 76.52, @expense_category_id, '周末买菜食材', '流水查询实操样例', '2026-03-09', NULL, '2026-10-08 08:14:00'),
  (@transaction_id_base + 30, @user_id, 'income', 12800.00, @income_category_id, '工资到账', '活动优惠10%，订单编号ORDER_2026', '2026-03-10', NULL, '2026-10-08 08:15:00'),
  (@transaction_id_base + 31, @user_id, 'expense', 33.07, @expense_category_id, '苹果和香蕉', '流水查询实操样例', '2026-06-01', NULL, '2026-10-08 08:15:00'),
  (@transaction_id_base + 32, @user_id, 'expense', 15.37, @expense_category_id, '超市零食', NULL, '2026-06-02', NULL, '2026-10-08 08:16:00'),
  (@transaction_id_base + 33, @user_id, 'expense', 18.17, @expense_category_id, NULL, '流水查询实操样例', '2026-06-03', '2026-10-08 11:00:00', '2026-10-08 08:16:00'),
  (@transaction_id_base + 34, @user_id, 'expense', 45.17, @expense_category_id, '周末电影票', '流水查询实操样例', '2026-06-04', NULL, '2026-10-08 08:17:00'),
  (@transaction_id_base + 35, @user_id, 'income', 3500.00, @income_category_id, '项目奖金', '历史补录，发生日期早于录入日期', '2026-06-05', NULL, '2026-10-08 08:17:00'),
  (@transaction_id_base + 36, @user_id, 'expense', 30.07, @expense_category_id, '抽纸和厨房纸', NULL, '2026-06-06', NULL, '2026-10-08 08:18:00'),
  (@transaction_id_base + 37, @user_id, 'expense', 0.01, @expense_category_id, '换季上衣', '流水查询实操样例', '2026-06-07', NULL, '2026-10-08 08:18:00'),
  (@transaction_id_base + 38, @user_id, 'expense', 2800.17, @expense_category_id, '当月房租', '流水查询实操样例', '2026-06-08', NULL, '2026-10-08 08:19:00'),
  (@transaction_id_base + 39, @user_id, 'expense', 93.63, @expense_category_id, '家庭电费', '流水查询实操样例', '2026-06-09', NULL, '2026-10-08 08:19:00'),
  (@transaction_id_base + 40, @user_id, 'income', 950.00, @income_category_id, '兼职开发收入', NULL, '2026-06-10', NULL, '2026-10-08 08:20:00'),
  (@transaction_id_base + 41, @user_id, 'expense', 1299.17, @expense_category_id, '办公显示器', '流水查询实操样例', '2026-08-01', NULL, '2026-10-08 08:20:00'),
  (@transaction_id_base + 42, @user_id, 'expense', 90.07, @expense_category_id, '键盘和数码配件', '活动优惠10%，订单编号ORDER_2026', '2026-08-02', NULL, '2026-10-08 08:21:00'),
  (@transaction_id_base + 43, @user_id, 'expense', 6.17, @expense_category_id, '公交地铁充值', '流水查询实操样例', '2026-08-03', NULL, '2026-10-08 08:21:00'),
  (@transaction_id_base + 44, @user_id, 'expense', 24.97, @expense_category_id, NULL, NULL, '2026-08-04', NULL, '2026-10-08 08:22:00'),
  (@transaction_id_base + 45, @user_id, 'income', 68.35, @income_category_id, '投资收益到账', '流水查询实操样例', '2026-08-05', NULL, '2026-10-08 08:22:00'),
  (@transaction_id_base + 46, @user_id, 'expense', 59.17, @expense_category_id, '手机话费充值', '流水查询实操样例', '2026-08-06', NULL, '2026-10-08 08:23:00'),
  (@transaction_id_base + 47, @user_id, 'expense', 78.17, @expense_category_id, '编程书籍', '流水查询实操样例', '2026-08-07', NULL, '2026-10-08 08:23:00'),
  (@transaction_id_base + 48, @user_id, 'expense', 399.17, @expense_category_id, '在线课程', NULL, '2026-08-08', NULL, '2026-10-08 08:24:00'),
  (@transaction_id_base + 49, @user_id, 'expense', 29.17, @expense_category_id, '软件月度订阅', '历史补录，发生日期早于录入日期', '2026-08-09', NULL, '2026-10-08 08:24:00'),
  (@transaction_id_base + 50, @user_id, 'income', 260.00, @income_category_id, '闲置物品出售', '流水查询实操样例', '2026-08-10', NULL, '2026-10-08 08:25:00'),
  (@transaction_id_base + 51, @user_id, 'expense', 8.84, @expense_category_id, '早餐豆浆和包子', '流水查询实操样例', '2026-09-01', NULL, '2026-10-08 08:25:00'),
  (@transaction_id_base + 52, @user_id, 'expense', 26.34, @expense_category_id, '工作日午餐', NULL, '2026-09-02', NULL, '2026-10-08 08:26:00'),
  (@transaction_id_base + 53, @user_id, 'expense', 39.14, @expense_category_id, '晚餐套餐', '流水查询实操样例', '2026-09-03', NULL, '2026-10-08 08:26:00'),
  (@transaction_id_base + 54, @user_id, 'expense', 76.69, @expense_category_id, '周末买菜食材', '活动优惠10%，订单编号ORDER_2026', '2026-09-04', NULL, '2026-10-08 08:27:00'),
  (@transaction_id_base + 55, @user_id, 'income', 12800.00, @income_category_id, NULL, '流水查询实操样例', '2026-09-05', NULL, '2026-10-08 08:27:00'),
  (@transaction_id_base + 56, @user_id, 'expense', 33.24, @expense_category_id, '苹果和香蕉', NULL, '2026-09-06', NULL, '2026-10-08 08:28:00'),
  (@transaction_id_base + 57, @user_id, 'expense', 15.54, @expense_category_id, '超市零食', '流水查询实操样例', '2026-09-07', NULL, '2026-10-08 08:28:00'),
  (@transaction_id_base + 58, @user_id, 'expense', 18.34, @expense_category_id, '下午咖啡', '流水查询实操样例', '2026-09-08', NULL, '2026-10-08 08:29:00'),
  (@transaction_id_base + 59, @user_id, 'expense', 45.34, @expense_category_id, '周末电影票', '流水查询实操样例', '2026-09-09', NULL, '2026-10-08 08:29:00'),
  (@transaction_id_base + 60, @user_id, 'income', 3500.00, @income_category_id, '项目奖金', NULL, '2026-09-10', NULL, '2026-10-08 08:30:00'),
  (@transaction_id_base + 61, @user_id, 'expense', 30.24, @expense_category_id, '抽纸和厨房纸', '流水查询实操样例', '2026-10-01', NULL, '2026-10-08 08:30:00'),
  (@transaction_id_base + 62, @user_id, 'expense', 159.34, @expense_category_id, '换季上衣', '流水查询实操样例', '2026-10-02', NULL, '2026-10-08 08:31:00'),
  (@transaction_id_base + 63, @user_id, 'expense', 2800.34, @expense_category_id, '当月房租', '历史补录，发生日期早于录入日期', '2026-10-03', NULL, '2026-10-08 08:31:00'),
  (@transaction_id_base + 64, @user_id, 'expense', 93.80, @expense_category_id, '家庭电费', NULL, '2026-10-04', NULL, '2026-10-08 08:32:00'),
  (@transaction_id_base + 65, @user_id, 'income', 950.00, @income_category_id, '兼职开发收入', '流水查询实操样例', '2026-10-05', NULL, '2026-10-08 08:32:00'),
  (@transaction_id_base + 66, @user_id, 'expense', 1299.34, @expense_category_id, NULL, '活动优惠10%，订单编号ORDER_2026', '2026-10-06', '2026-10-08 11:00:00', '2026-10-08 08:33:00'),
  (@transaction_id_base + 67, @user_id, 'expense', 90.24, @expense_category_id, '键盘和数码配件', '流水查询实操样例', '2026-10-07', NULL, '2026-10-08 08:33:00'),
  (@transaction_id_base + 68, @user_id, 'expense', 6.34, @expense_category_id, '公交地铁充值', NULL, '2026-10-08', NULL, '2026-10-08 08:34:00'),
  (@transaction_id_base + 69, @user_id, 'expense', 25.14, @expense_category_id, '下雨天打车', '流水查询实操样例', '2026-10-01', NULL, '2026-10-08 08:34:00'),
  (@transaction_id_base + 70, @user_id, 'income', 68.35, @income_category_id, '投资收益到账', '历史补录，发生日期早于录入日期', '2026-10-02', NULL, '2026-10-08 08:35:00'),
  (@transaction_id_base + 71, @user_id, 'expense', 59.34, @expense_category_id, '早餐优惠100%原价对照', '流水查询实操样例', '2026-10-03', NULL, '2026-10-08 08:35:00'),
  (@transaction_id_base + 72, @user_id, 'expense', 78.34, @expense_category_id, 'A_B套餐实付', NULL, '2026-10-04', NULL, '2026-10-08 08:36:00'),
  (@transaction_id_base + 73, @user_id, 'expense', 399.34, @expense_category_id, '在线课程', '返现100%到账，凭证REF_A01', '2026-10-05', NULL, '2026-10-08 08:36:00'),
  (@transaction_id_base + 74, @user_id, 'expense', 29.34, @expense_category_id, '软件月度订阅', '流水查询实操样例', '2026-10-06', NULL, '2026-10-08 08:37:00'),
  (@transaction_id_base + 75, @user_id, 'income', 260.00, @income_category_id, '闲置物品出售', '流水查询实操样例', '2026-10-07', NULL, '2026-10-08 08:37:00'),
  (@transaction_id_base + 76, @user_id, 'expense', 9.01, @expense_category_id, '早餐豆浆和包子', NULL, '2026-10-08', NULL, '2026-10-08 08:38:00'),
  (@transaction_id_base + 77, @user_id, 'expense', 26.51, @expense_category_id, NULL, '历史补录，发生日期早于录入日期', '2026-10-01', NULL, '2026-10-08 08:38:00'),
  (@transaction_id_base + 78, @user_id, 'expense', 39.31, @expense_category_id, '晚餐套餐', '活动优惠10%，订单编号ORDER_2026', '2026-10-02', NULL, '2026-10-08 08:39:00'),
  (@transaction_id_base + 79, @user_id, 'expense', 76.86, @expense_category_id, '周末买菜食材', '流水查询实操样例', '2026-10-03', NULL, '2026-10-08 08:39:00'),
  (@transaction_id_base + 80, @user_id, 'income', 12800.00, @income_category_id, '工资到账', NULL, '2026-10-04', NULL, '2026-10-08 08:40:00'),
  (@transaction_id_base + 81, @user_id, 'expense', 33.41, @expense_category_id, '苹果和香蕉', '流水查询实操样例', '2026-10-05', NULL, '2026-10-08 08:40:00'),
  (@transaction_id_base + 82, @user_id, 'expense', 15.71, @expense_category_id, '超市零食', '流水查询实操样例', '2026-10-06', NULL, '2026-10-08 08:41:00'),
  (@transaction_id_base + 83, @user_id, 'expense', 18.51, @expense_category_id, '下午咖啡', '流水查询实操样例', '2026-10-07', NULL, '2026-10-08 08:41:00'),
  (@transaction_id_base + 84, @user_id, 'expense', 45.51, @expense_category_id, '周末电影票', NULL, '2026-10-08', NULL, '2026-10-08 08:42:00'),
  (@transaction_id_base + 85, @user_id, 'income', 3500.00, @income_category_id, '项目奖金', '流水查询实操样例', '2026-10-01', NULL, '2026-10-08 08:42:00'),
  (@transaction_id_base + 86, @user_id, 'expense', 30.41, @expense_category_id, '抽纸和厨房纸', '流水查询实操样例', '2026-10-02', NULL, '2026-10-08 08:43:00'),
  (@transaction_id_base + 87, @user_id, 'expense', 159.51, @expense_category_id, '换季上衣', '流水查询实操样例', '2026-10-03', NULL, '2026-10-08 08:43:00'),
  (@transaction_id_base + 88, @user_id, 'expense', 2800.51, @expense_category_id, NULL, NULL, '2026-10-04', NULL, '2026-10-08 08:44:00'),
  (@transaction_id_base + 89, @user_id, 'expense', 93.97, @expense_category_id, '家庭电费', '流水查询实操样例', '2026-10-05', NULL, '2026-10-08 08:44:00'),
  (@transaction_id_base + 90, @user_id, 'income', 950.00, @income_category_id, '兼职开发收入', '活动优惠10%，订单编号ORDER_2026', '2026-10-06', NULL, '2026-10-08 08:45:00'),
  (@transaction_id_base + 91, @user_id, 'expense', 1299.51, @expense_category_id, '办公显示器', '历史补录，发生日期早于录入日期', '2026-10-07', NULL, '2026-10-08 08:45:00'),
  (@transaction_id_base + 92, @user_id, 'expense', 90.41, @expense_category_id, '键盘和数码配件', NULL, '2026-10-08', NULL, '2026-10-08 08:46:00'),
  (@transaction_id_base + 93, @user_id, 'expense', 6.51, @expense_category_id, '公交地铁充值', '流水查询实操样例', '2026-10-01', NULL, '2026-10-08 08:46:00'),
  (@transaction_id_base + 94, @user_id, 'expense', 25.31, @expense_category_id, '下雨天打车', '流水查询实操样例', '2026-10-02', NULL, '2026-10-08 08:47:00'),
  (@transaction_id_base + 95, @user_id, 'income', 68.35, @income_category_id, '投资收益到账', '流水查询实操样例', '2026-10-03', NULL, '2026-10-08 08:47:00'),
  (@transaction_id_base + 96, @user_id, 'expense', 59.51, @expense_category_id, '手机话费充值', NULL, '2026-10-04', NULL, '2026-10-08 08:48:00'),
  (@transaction_id_base + 97, @user_id, 'expense', 78.51, @expense_category_id, '编程书籍', '流水查询实操样例', '2026-10-05', NULL, '2026-10-08 08:48:00'),
  (@transaction_id_base + 98, @user_id, 'expense', 399.51, @expense_category_id, '在线课程', '历史补录，发生日期早于录入日期', '2026-10-06', NULL, '2026-10-08 08:49:00'),
  (@transaction_id_base + 99, @user_id, 'expense', 29.51, @expense_category_id, NULL, '流水查询实操样例', '2026-10-07', '2026-10-08 11:00:00', '2026-10-08 08:49:00'),
  (@transaction_id_base + 100, @user_id, 'income', 260.00, @income_category_id, '闲置物品出售', NULL, '2026-10-08', NULL, '2026-10-08 08:50:00');

INSERT INTO transaction_tags (transaction_id, tag_id)
VALUES
  (@transaction_id_base + 1, @tag_id_base + 1), (@transaction_id_base + 2, @tag_id_base + 2), (@transaction_id_base + 3, @tag_id_base + 3),
  (@transaction_id_base + 3, @tag_id_base + 5), (@transaction_id_base + 5, @tag_id_base + 5), (@transaction_id_base + 6, @tag_id_base + 6),
  (@transaction_id_base + 6, @tag_id_base + 1), (@transaction_id_base + 7, @tag_id_base + 7), (@transaction_id_base + 9, @tag_id_base + 2),
  (@transaction_id_base + 9, @tag_id_base + 4), (@transaction_id_base + 10, @tag_id_base + 3), (@transaction_id_base + 10, @tag_id_base + 8),
  (@transaction_id_base + 11, @tag_id_base + 4), (@transaction_id_base + 13, @tag_id_base + 6), (@transaction_id_base + 14, @tag_id_base + 7),
  (@transaction_id_base + 15, @tag_id_base + 1), (@transaction_id_base + 15, @tag_id_base + 3), (@transaction_id_base + 17, @tag_id_base + 3),
  (@transaction_id_base + 18, @tag_id_base + 4), (@transaction_id_base + 18, @tag_id_base + 6), (@transaction_id_base + 19, @tag_id_base + 5),
  (@transaction_id_base + 21, @tag_id_base + 7), (@transaction_id_base + 21, @tag_id_base + 2), (@transaction_id_base + 22, @tag_id_base + 1),
  (@transaction_id_base + 23, @tag_id_base + 2), (@transaction_id_base + 25, @tag_id_base + 4), (@transaction_id_base + 26, @tag_id_base + 5),
  (@transaction_id_base + 27, @tag_id_base + 6), (@transaction_id_base + 27, @tag_id_base + 1), (@transaction_id_base + 29, @tag_id_base + 1),
  (@transaction_id_base + 30, @tag_id_base + 2), (@transaction_id_base + 30, @tag_id_base + 4), (@transaction_id_base + 30, @tag_id_base + 8),
  (@transaction_id_base + 31, @tag_id_base + 3), (@transaction_id_base + 33, @tag_id_base + 5), (@transaction_id_base + 33, @tag_id_base + 7),
  (@transaction_id_base + 34, @tag_id_base + 6), (@transaction_id_base + 35, @tag_id_base + 7), (@transaction_id_base + 37, @tag_id_base + 2),
  (@transaction_id_base + 38, @tag_id_base + 3), (@transaction_id_base + 39, @tag_id_base + 4), (@transaction_id_base + 39, @tag_id_base + 6),
  (@transaction_id_base + 41, @tag_id_base + 6), (@transaction_id_base + 42, @tag_id_base + 7), (@transaction_id_base + 42, @tag_id_base + 2),
  (@transaction_id_base + 43, @tag_id_base + 1), (@transaction_id_base + 45, @tag_id_base + 3), (@transaction_id_base + 45, @tag_id_base + 5),
  (@transaction_id_base + 46, @tag_id_base + 4), (@transaction_id_base + 47, @tag_id_base + 5), (@transaction_id_base + 49, @tag_id_base + 7),
  (@transaction_id_base + 50, @tag_id_base + 1), (@transaction_id_base + 50, @tag_id_base + 8), (@transaction_id_base + 51, @tag_id_base + 2),
  (@transaction_id_base + 51, @tag_id_base + 4), (@transaction_id_base + 53, @tag_id_base + 4), (@transaction_id_base + 54, @tag_id_base + 5),
  (@transaction_id_base + 54, @tag_id_base + 7), (@transaction_id_base + 55, @tag_id_base + 6), (@transaction_id_base + 57, @tag_id_base + 1),
  (@transaction_id_base + 57, @tag_id_base + 3), (@transaction_id_base + 58, @tag_id_base + 2), (@transaction_id_base + 59, @tag_id_base + 3),
  (@transaction_id_base + 61, @tag_id_base + 5), (@transaction_id_base + 62, @tag_id_base + 6), (@transaction_id_base + 63, @tag_id_base + 7),
  (@transaction_id_base + 63, @tag_id_base + 2), (@transaction_id_base + 65, @tag_id_base + 2), (@transaction_id_base + 66, @tag_id_base + 3),
  (@transaction_id_base + 66, @tag_id_base + 5), (@transaction_id_base + 67, @tag_id_base + 4), (@transaction_id_base + 69, @tag_id_base + 6),
  (@transaction_id_base + 69, @tag_id_base + 1), (@transaction_id_base + 70, @tag_id_base + 7), (@transaction_id_base + 70, @tag_id_base + 8),
  (@transaction_id_base + 71, @tag_id_base + 1), (@transaction_id_base + 73, @tag_id_base + 3), (@transaction_id_base + 74, @tag_id_base + 4),
  (@transaction_id_base + 75, @tag_id_base + 5), (@transaction_id_base + 75, @tag_id_base + 7), (@transaction_id_base + 77, @tag_id_base + 7),
  (@transaction_id_base + 78, @tag_id_base + 1), (@transaction_id_base + 78, @tag_id_base + 3), (@transaction_id_base + 79, @tag_id_base + 2),
  (@transaction_id_base + 81, @tag_id_base + 4), (@transaction_id_base + 81, @tag_id_base + 6), (@transaction_id_base + 82, @tag_id_base + 5),
  (@transaction_id_base + 83, @tag_id_base + 6), (@transaction_id_base + 85, @tag_id_base + 1), (@transaction_id_base + 86, @tag_id_base + 2),
  (@transaction_id_base + 87, @tag_id_base + 3), (@transaction_id_base + 87, @tag_id_base + 5), (@transaction_id_base + 89, @tag_id_base + 5),
  (@transaction_id_base + 90, @tag_id_base + 6), (@transaction_id_base + 90, @tag_id_base + 1), (@transaction_id_base + 90, @tag_id_base + 8),
  (@transaction_id_base + 91, @tag_id_base + 7), (@transaction_id_base + 93, @tag_id_base + 2), (@transaction_id_base + 93, @tag_id_base + 4),
  (@transaction_id_base + 94, @tag_id_base + 3), (@transaction_id_base + 95, @tag_id_base + 4), (@transaction_id_base + 97, @tag_id_base + 6),
  (@transaction_id_base + 98, @tag_id_base + 7), (@transaction_id_base + 99, @tag_id_base + 1), (@transaction_id_base + 99, @tag_id_base + 3);

COMMIT;
