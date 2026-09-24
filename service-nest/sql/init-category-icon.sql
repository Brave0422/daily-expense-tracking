-- 分类图标库初始化数据。
-- 数据来源：web/src/assets/icons/categories/manifest.json。
-- default_sort 按 manifest 中一级分类、二级分类、通用图标的声明顺序从 0 连续编号。

SET NAMES utf8mb4;

START TRANSACTION;

-- 默认一级分类图标：支出 15 个，收入 5 个。
INSERT INTO `category_icon` (`icon_key`, `name`, `background_color`, `default_sort`)
VALUES
  ('icon-expense-meals', '三餐', '#FF873D', 0),
  ('icon-expense-meal-food', '正餐食品', '#E96F51', 1),
  ('icon-expense-snacks-drinks', '零食饮品', '#F2A82F', 2),
  ('icon-expense-entertainment', '休闲娱乐', '#8A63E8', 3),
  ('icon-expense-household', '日用家居', '#35B99D', 4),
  ('icon-expense-clothing', '服饰穿搭', '#EC6683', 5),
  ('icon-expense-personal-care', '个人护理', '#DC65A0', 6),
  ('icon-expense-housing', '住房', '#3EBB70', 7),
  ('icon-expense-digital', '数码产品', '#4F8BE8', 8),
  ('icon-expense-transport', '交通出行', '#3290DF', 9),
  ('icon-expense-communication', '通讯网络', '#6674D9', 10),
  ('icon-expense-medical', '医疗健康', '#EB6076', 11),
  ('icon-expense-education', '学习教育', '#D59419', 12),
  ('icon-expense-digital-services', '数字服务', '#5368D8', 13),
  ('icon-expense-social', '人情往来', '#EF5B7A', 14),
  ('icon-income-salary', '工资', '#29AD68', 15),
  ('icon-income-bonus', '奖金', '#36B577', 16),
  ('icon-income-side-business', '兼职副业', '#2EA982', 17),
  ('icon-income-investment', '投资收益', '#25A1A1', 18),
  ('icon-income-secondhand-sale', '二手出售', '#45AA6F', 19)
ON DUPLICATE KEY UPDATE
  `name` = VALUES(`name`),
  `background_color` = VALUES(`background_color`),
  `default_sort` = VALUES(`default_sort`);

-- 默认二级分类图标：仅支出分类拥有二级分类，共 62 个。
INSERT INTO `category_icon` (`icon_key`, `name`, `background_color`, `default_sort`)
VALUES
  ('icon-expense-meals-breakfast', '早餐', '#FF873D', 20),
  ('icon-expense-meals-lunch', '午餐', '#FF873D', 21),
  ('icon-expense-meals-dinner', '晚餐', '#FF873D', 22),
  ('icon-expense-meals-groceries', '买菜食材', '#FF873D', 23),
  ('icon-expense-meal-food-staple-food', '基础食品', '#E96F51', 24),
  ('icon-expense-meal-food-daily-fruit', '日常水果', '#E96F51', 25),
  ('icon-expense-snacks-drinks-leisure-snacks', '休闲零食', '#F2A82F', 26),
  ('icon-expense-snacks-drinks-late-night-snack', '夜宵', '#F2A82F', 27),
  ('icon-expense-snacks-drinks-beverages', '饮料茶饮', '#F2A82F', 28),
  ('icon-expense-snacks-drinks-desserts-snacks', '甜品小吃', '#F2A82F', 29),
  ('icon-expense-entertainment-games', '游戏', '#8A63E8', 30),
  ('icon-expense-entertainment-tickets', '门票', '#8A63E8', 31),
  ('icon-expense-entertainment-movies', '电影', '#8A63E8', 32),
  ('icon-expense-household-personal-cleaning', '个人清洁', '#35B99D', 33),
  ('icon-expense-household-home-cleaning', '家居清洁', '#35B99D', 34),
  ('icon-expense-household-paper-consumables', '纸品耗材', '#35B99D', 35),
  ('icon-expense-household-kitchen', '厨房用品', '#35B99D', 36),
  ('icon-expense-household-home-furnishing', '家居用品', '#35B99D', 37),
  ('icon-expense-household-other-daily', '其他日用', '#35B99D', 38),
  ('icon-expense-clothing-tops', '上衣', '#EC6683', 39),
  ('icon-expense-clothing-bottoms', '下装', '#EC6683', 40),
  ('icon-expense-clothing-shoes', '鞋子', '#EC6683', 41),
  ('icon-expense-clothing-underwear-socks', '内衣袜子', '#EC6683', 42),
  ('icon-expense-personal-care-haircut', '理发', '#DC65A0', 43),
  ('icon-expense-personal-care-skincare', '护肤品', '#DC65A0', 44),
  ('icon-expense-housing-rent', '房租', '#3EBB70', 45),
  ('icon-expense-housing-water', '水费', '#3EBB70', 46),
  ('icon-expense-housing-electricity', '电费', '#3EBB70', 47),
  ('icon-expense-housing-gas', '燃气费', '#3EBB70', 48),
  ('icon-expense-housing-mortgage', '房贷', '#3EBB70', 49),
  ('icon-expense-housing-property-fee', '物业费', '#3EBB70', 50),
  ('icon-expense-digital-phone', '手机平板', '#4F8BE8', 51),
  ('icon-expense-digital-computer', '电脑', '#4F8BE8', 52),
  ('icon-expense-digital-digital-accessories', '数码配件', '#4F8BE8', 53),
  ('icon-expense-digital-digital-repair', '数码维修', '#4F8BE8', 54),
  ('icon-expense-transport-public-transit', '公交地铁', '#3290DF', 55),
  ('icon-expense-transport-taxi', '打车', '#3290DF', 56),
  ('icon-expense-transport-shared-bike', '共享单车', '#3290DF', 57),
  ('icon-expense-transport-train', '火车', '#3290DF', 58),
  ('icon-expense-transport-high-speed-rail', '高铁', '#3290DF', 59),
  ('icon-expense-transport-flight', '飞机', '#3290DF', 60),
  ('icon-expense-transport-cruise', '游轮', '#3290DF', 61),
  ('icon-expense-transport-parking', '停车', '#3290DF', 62),
  ('icon-expense-communication-phone-bill', '手机话费', '#6674D9', 63),
  ('icon-expense-communication-mobile-data', '流量费', '#6674D9', 64),
  ('icon-expense-communication-broadband', '宽带费', '#6674D9', 65),
  ('icon-expense-medical-medicine', '药品', '#EB6076', 66),
  ('icon-expense-medical-doctor', '就诊', '#EB6076', 67),
  ('icon-expense-medical-examination', '检查', '#EB6076', 68),
  ('icon-expense-education-books', '书籍资料', '#D59419', 69),
  ('icon-expense-education-exam-certification', '考试认证', '#D59419', 70),
  ('icon-expense-education-course-training', '课程培训', '#D59419', 71),
  ('icon-expense-education-tuition', '学费', '#D59419', 72),
  ('icon-expense-education-study-supplies', '学习用品', '#D59419', 73),
  ('icon-expense-digital-services-software-subscription', '软件订阅', '#5368D8', 74),
  ('icon-expense-digital-services-cloud-server', '云服务器', '#5368D8', 75),
  ('icon-expense-digital-services-cloud-storage', '云存储', '#5368D8', 76),
  ('icon-expense-digital-services-network-service', '网络服务', '#5368D8', 77),
  ('icon-expense-social-family-support', '孝亲支出', '#EF5B7A', 78),
  ('icon-expense-social-red-packet', '红包礼金', '#EF5B7A', 79),
  ('icon-expense-social-donation', '捐赠', '#EF5B7A', 80),
  ('icon-expense-social-gifts', '礼物', '#EF5B7A', 81)
ON DUPLICATE KEY UPDATE
  `name` = VALUES(`name`),
  `background_color` = VALUES(`background_color`),
  `default_sort` = VALUES(`default_sort`);

-- 通用预选图标：28 个。
INSERT INTO `category_icon` (`icon_key`, `name`, `background_color`, `default_sort`)
VALUES
  ('icon-category-coffee', '咖啡', '#B9794D', 82),
  ('icon-category-takeout', '外卖', '#F0803C', 83),
  ('icon-category-alcohol', '酒水', '#A16BC1', 84),
  ('icon-category-tobacco', '烟草', '#7C8797', 85),
  ('icon-category-shopping', '购物', '#E9608E', 86),
  ('icon-category-pets', '宠物', '#E99545', 87),
  ('icon-category-pet-food', '宠物食品', '#BF8654', 88),
  ('icon-category-veterinary', '宠物医疗', '#E5687C', 89),
  ('icon-category-baby-care', '母婴', '#EB83AD', 90),
  ('icon-category-toys', '玩具', '#EDA42F', 91),
  ('icon-category-fitness', '健身', '#4B96CF', 92),
  ('icon-category-music', '音乐娱乐', '#8465D7', 93),
  ('icon-category-dental', '牙科', '#43AEB9', 94),
  ('icon-category-glasses', '眼镜', '#5879C7', 95),
  ('icon-category-cosmetics', '美妆', '#D65E9A', 96),
  ('icon-category-jewelry', '珠宝首饰', '#A56BDB', 97),
  ('icon-category-fuel', '汽车加油', '#4A85D0', 98),
  ('icon-category-car-maintenance', '汽车保养', '#607F99', 99),
  ('icon-category-car-wash', '洗车', '#36A5CB', 100),
  ('icon-category-toll', '高速过路费', '#5578BC', 101),
  ('icon-category-hotel', '酒店住宿', '#3FAE72', 102),
  ('icon-category-luggage', '旅行行李', '#40977F', 103),
  ('icon-category-camping', '露营', '#5A9E57', 104),
  ('icon-category-laundry', '洗衣', '#39AD98', 105),
  ('icon-category-home-appliance', '家用电器', '#43A19D', 106),
  ('icon-category-home-repair', '装修维修', '#D28A37', 107),
  ('icon-category-express-delivery', '快递物流', '#DE7840', 108),
  ('icon-category-insurance', '保险', '#5077BE', 109)
ON DUPLICATE KEY UPDATE
  `name` = VALUES(`name`),
  `background_color` = VALUES(`background_color`),
  `default_sort` = VALUES(`default_sort`);

COMMIT;
