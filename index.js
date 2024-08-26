"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const backpack_client_1 = require("./backpack_client");
const { checkbox } = require("@inquirer/prompts");
const input = require("@inquirer/input");
const number = require("@inquirer/number");
const fs = require("fs");
const moment = require("moment");
require("dotenv").config();
const STATE_FILE = 'trading_state.json';

/**
 * 异步读取并解析 JSON 文件
 * @param {string} filename - 要读取的文件名
 * @returns {Promise<Object>} 解析后的 JSON 对象
 * @throws {Error} 如果文件读取或 JSON 解析失败
 */

function readJsonFile(filename) {
  return new Promise((resolve, reject) => {
    fs.readFile(filename, "utf8", (err, data) => {
      if (err) {
        reject(new Error(`读取文件时出错: ${err.message}`));
      } else {
        try {
          const jsonData = JSON.parse(data);
          console.log("jsonData:", jsonData);
          resolve(jsonData);
        } catch (parseError) {
          reject(new Error(`解析 JSON 数据时出错: ${parseError.message}`));
        }
      }
    });
  });
}
 /**
 * 加载代币列表
 * @returns {Promise<Object>} 代币列表对象
 * @throws {Error} 如果加载过程中出现错误
 */

async function loadTokenList() {
  const filename = "tokenList.json";
  try {
    const tokenList = await readJsonFile(filename);
    console.log("读取的 tokenList 数据:");
    console.log(JSON.stringify(tokenList, null, 2));
    return tokenList;
  } catch (error) {
    console.error("读取文件过程中出错:", error);
    throw error;
  }
}


/**
 * 延迟函数
 * @param {number} ms - 延迟的毫秒数
 * @returns {Promise} 延迟结束后解决的Promise
 */
 
function delay(ms) {
    return new Promise(resolve => {
        setTimeout(resolve, ms);
    });
}

/**
 * 从数组中随机选择一个索引
 * @param {Array} array - 输入数组
 * @returns {number} 随机索引
 */
 
function getRandomIndex(array) {
    return Math.floor(Math.random() * array.length);
}

/**
 * 获取当前格式化的日期时间字符串
 * @returns {string} 格式化的日期时间字符串
 */
 
function getNowFormatDate() {
    var date = new Date();
    var seperator1 = "-";
    var seperator2 = ":";
    var month = date.getMonth() + 1;
    var strDate = date.getDate();
    var strHour = date.getHours();
    var strMinute = date.getMinutes();
    var strSecond = date.getSeconds();
    if (month >= 1 && month <= 9) {
        month = "0" + month;
    }
    if (strDate >= 0 && strDate <= 9) {
        strDate = "0" + strDate;
    }
    if (strHour >= 0 && strHour <= 9) {
        strHour = "0" + strHour;
    }
    if (strMinute >= 0 && strMinute <= 9) {
        strMinute = "0" + strMinute;
    }
    if (strSecond >= 0 && strSecond <= 9) {
        strSecond = "0" + strSecond;
    }
    var currentdate = date.getFullYear() + seperator1 + month + seperator1 + strDate
        + " " + strHour + seperator2 + strMinute
        + seperator2 + strSecond;
    return currentdate;
}

/**
 * 计算数字的小数位数
 * @param {number} number - 输入数字
 * @returns {number} 小数位数
 */
 
function countDecimalPlaces(number) {
    let decimalPart = String(number).match(/\.(\d*)/);
    return decimalPart ? decimalPart[1].length : 0;
}

let successbuy = 0;
let sellbuy = 0;
let totalTrades = 0;
let startTime;
let dailyLimit;
let restartDelay;
let runDays;
let currentDay = 1;


/**
 * 保存交易状态到文件
 */
function saveState() {
    const currentDate = moment().format('YYYY-MM-DD');
    const state = {
        dailyTrades: {
            [currentDate]: totalTrades
        },
        currentDay,
        startTime: Date.now(),
        successbuy,
        sellbuy
    };
    fs.writeFileSync(STATE_FILE, JSON.stringify(state));
}
// 相反，我们可以在程序开始时初始化这些变量（如果它们还没有被初始化的话）
if (typeof totalTrades === 'undefined') totalTrades = 0;
if (typeof currentDay === 'undefined') currentDay = 1;
if (typeof startTime === 'undefined') startTime = Date.now();
if (typeof successbuy === 'undefined') successbuy = 0;
if (typeof sellbuy === 'undefined') sellbuy = 0;
/**
 * 从文件加载交易状态
 * @returns {boolean} 是否成功加载状态
 */
function loadState() {
    if (fs.existsSync(STATE_FILE)) {
        const state = JSON.parse(fs.readFileSync(STATE_FILE));
        const currentDate = moment().format('YYYY-MM-DD');
        totalTrades = state.dailyTrades?.[currentDate] || 0;
        currentDay = state.currentDay || 1;
        startTime = state.startTime || Date.now();
        successbuy = state.successbuy || 0;
        sellbuy = state.sellbuy || 0;
        return true;
    }
    return false;
}
// 在程序启动时重置计数器
const resetDailyCounterIfNeeded = () => {
    const currentDate = moment().format('YYYY-MM-DD');
    if (!fs.existsSync(STATE_FILE)) {
        // 如果状态文件不存在，创建一个新的
        saveState();
        return;
    }

    const state = JSON.parse(fs.readFileSync(STATE_FILE));
    if (!state.dailyTrades || !state.dailyTrades[currentDate]) {
        // 如果当天没有交易记录，重置计数器
        totalTrades = 0;
        if (!state.dailyTrades) {
            state.dailyTrades = {};
        }
        state.dailyTrades[currentDate] = 0;
        fs.writeFileSync(STATE_FILE, JSON.stringify(state));
    } else {
        totalTrades = state.dailyTrades[currentDate];
    }
}


/**
 * 初始化并开始交易
 * @param {Object} client - Backpack客户端实例
 * @param {Array} token - 代币列表
 * @param {Array} random - 随机延迟时间列表
 * @param {Array} money - 随机交易金额比例列表
 */
 
const init = async (client, token, random, money) => {
    let markets = await client.Markets();
    let tokensDecimal = {};
    markets.forEach((market) => {
        tokensDecimal[market.symbol] = countDecimalPlaces(market.filters.quantity.minQuantity);
    });
    console.log(getNowFormatDate(), "初始化完成");

    const stateLoaded = loadState();
    if (!stateLoaded) {
        startTime = Date.now();
        saveState();
    }

    while (currentDay <= runDays) {
        try {
            const currentDate = moment().format('YYYY-MM-DD');
            if (totalTrades >= dailyLimit) {
                console.log(getNowFormatDate(), `达到每日交易限制 ${dailyLimit}次，等待下一个交易周期`);
                await delay(restartDelay * 60 * 60 * 1000);
                totalTrades = 0;
                currentDay++;
                startTime = Date.now();
                saveState();
                if (currentDay > runDays) {
                    console.log(getNowFormatDate(), `已完成设定的 ${runDays} 天交易，程序结束`);
                    return;
                }
                console.log(getNowFormatDate(), `开始第 ${currentDay} 天的交易`);
            }

            let tokenIndex = getRandomIndex(token);
            let randomIndex = getRandomIndex(random);
            let moneyIndex = getRandomIndex(money);

            console.log(`成功买入次数:${successbuy},成功卖出次数:${sellbuy}`);
            console.log(getNowFormatDate(), `等待${random[randomIndex]}秒...`);
            await delay(random[randomIndex]*1000);
            console.log(getNowFormatDate(), "正在获取账户信息中...");
            let userbalance = await client.Balance();
            let tokenPriceList = await client.Tickers();
            Object.keys(userbalance).map((item) => {
                if (item == 'USDC') {
                    userbalance[item].value = userbalance[item].available;
                    userbalance[item].symbol = `USDC`;
                    return;
                };
                userbalance[item].value = userbalance[item].available * tokenPriceList.find((token) => token.symbol == `${item}_USDC`).lastPrice;
                userbalance[item].symbol = `${item}_USDC`;
            })
            let maxToken = Object.keys(userbalance).filter((item) => item != 'USDC' && token.includes(`${item}_USDC`)).reduce((a, b) => userbalance[a].value > userbalance[b].value ? a : b);
            console.log('账号价值最大的币种',maxToken);
            let condition1 = maxToken == "USDC" ? true : userbalance[maxToken].value < 8;
            if (userbalance.USDC.available > 5 && condition1) {
                await buyfun(client, token[tokenIndex], money[moneyIndex], tokensDecimal);
            } else {
                await sellfun(client, `${maxToken}_USDC`, money[moneyIndex], tokensDecimal);
            }

            totalTrades++;
            saveState();
        } catch (e) {
            console.log(getNowFormatDate(), "挂单失败，重新挂单中...");
            await delay(1000);
        }
    }
}


/**
 * 执行卖出操作
 * @param {Object} client - Backpack客户端实例
 * @param {string} token - 交易对
 * @param {number} money - 交易金额比例
 * @param {Object} tokensDecimal - 代币小数位数信息
 */
 
const sellfun = async (client, token, money, tokensDecimal) => {
    let GetOpenOrders = await client.GetOpenOrders({ symbol: token });
    if (GetOpenOrders.length > 0) {
        let CancelOpenOrders = await client.CancelOpenOrders({ symbol: token });
        console.log(getNowFormatDate(), "取消了所有挂单");
    } else {
        console.log(getNowFormatDate(), "账号订单正常，无需取消挂单");
    }
    console.log(getNowFormatDate(), "正在获取账户信息中...");
    let userbalance2 = await client.Balance();
    console.log(getNowFormatDate(), "账户信息:", userbalance2);
    console.log(getNowFormatDate(), `正在获取${token}的市场当前价格中...`);
    let currentToken = token.split('_')[0];
    let { lastPrice: lastPriceask } = await client.Ticker({ symbol: token });
    console.log(getNowFormatDate(), `${token}的市场当前价格:`, lastPriceask);
    let quantitys = ((userbalance2[currentToken].available * (money / 100))).toFixed(tokensDecimal[token]).toString();
    console.log(getNowFormatDate(), `正在卖出中... 卖${quantitys}个${token}`);
    let orderResultAsk = await client.ExecuteOrder({
        orderType: "Limit",
        postOnly: false,
        price: lastPriceask.toString(),
        quantity: quantitys,
        side: "Ask",
        symbol: token
    })
    
    if (orderResultAsk?.status == "Filled" && orderResultAsk?.side == "Ask") {
        console.log(getNowFormatDate(), "卖出成功");
        sellbuy += 1;
        console.log(getNowFormatDate(), "订单详情:", `卖出价格:${orderResultAsk.price}, 卖出数量:${orderResultAsk.quantity}, 订单号:${orderResultAsk.id}`);
        saveState();
    } else {
        console.log(getNowFormatDate(), "卖出失败");
        throw new Error("卖出失败");
    }
}

/**
 * 执行买入操作
 * @param {Object} client - Backpack客户端实例
 * @param {string} token - 交易对
 * @param {number} money - 交易金额比例
 * @param {Object} tokensDecimal - 代币小数位数信息
 */
const buyfun = async (client, token, money, tokensDecimal) => {
    let GetOpenOrders = await client.GetOpenOrders({ symbol: token });
    if (GetOpenOrders.length > 0) {
        let CancelOpenOrders = await client.CancelOpenOrders({ symbol: token });
        console.log(getNowFormatDate(), "取消了所有挂单");
    } else {
        console.log(getNowFormatDate(), "账号订单正常，无需取消挂单");
    }
    console.log(getNowFormatDate(), "正在获取账户信息中...");
    let userbalance = await client.Balance();
    console.log(getNowFormatDate(), "账户信息:", userbalance);
    console.log(getNowFormatDate(), "正在获取" + token + "的市场当前价格中...");
    let PayUSDC = (userbalance.USDC.available * (money / 100)) - 2;
    let { lastPrice } = await client.Ticker({ symbol: token });
    console.log(getNowFormatDate(), "" + token + "的市场当前价格:", lastPrice);
    console.log(token,'小数位',tokensDecimal[token]);
    console.log(getNowFormatDate(), `正在买入中... 花${(PayUSDC).toFixed(tokensDecimal[token]).toString()}个USDC买${token}`);
    let quantitys = ((PayUSDC) / lastPrice).toFixed(tokensDecimal[token]).toString();
    let orderResultBid = await client.ExecuteOrder({
        orderType: "Limit",
        price: lastPrice.toString(),
        quantity: quantitys,
        side: "Bid",
        symbol: token,
        timeInForce: "IOC"
    })
    if (orderResultBid?.status == "Filled" && orderResultBid?.side == "Bid") {
        console.log(getNowFormatDate(), "下单成功");
        successbuy += 1;
        console.log(getNowFormatDate(), "订单详情:", `购买价格:${orderResultBid.price}, 购买数量:${orderResultBid.quantity}, 订单号:${orderResultBid.id}`);
        saveState();
    } else {
        console.log(getNowFormatDate(), "下单失败");
        throw new Error("买入失败");
    }
}

// 主程序

loadState();
resetDailyCounterIfNeeded();
(async () => {
  try {
    // 加载 tokenList
    const tokenList = await loadTokenList();

    // 使用加载的 tokenList
    const tokenAnswer = await checkbox(tokenList);
    if (tokenAnswer.length == 0) {
      console.log("未选择币种，退出");
      return;
    }
    console.log("已选", tokenAnswer);

    dailyLimit = await number.default({
      message: "请输入每日最大交易次数:",
      default: 100,
      validate: (value) => value > 0 || "请输入大于0的数字",
    });
    console.log(`每日最大交易次数设置为: ${dailyLimit}`);

    restartDelay = await number.default({
      message: "请输入达到每日限制后等待多少小时继续运行:",
      default: 24,
      validate: (value) => value > 0 || "请输入大于0的数字",
    });
    console.log(`达到每日限制后将等待 ${restartDelay} 小时继续运行`);

    runDays = await number.default({
      message: "请输入脚本运行天数:",
      default: 7,
      validate: (value) => value > 0 || "请输入大于0的数字",
    });
    console.log(`脚本将运行 ${runDays} 天`);

    const randomAnser = await input.default({
      message: "请输入交易随机时间间隔(秒)格式为 数字-数字，默认可不填",
      default: "1-3",
      validate: function (value) {
        const pass = value.match(/^\d+-\d+$/);
        if (pass) {
          const numbers = value.split("-").map(Number);
          if (numbers[0] < numbers[1]) {
            return true;
          }
          return "第一个数字必须小于第二个数字！";
        }
        return '请输入正确格式的字符串（例如 "12-43"）！';
      },
    });
    console.log(`已选${randomAnser}秒 随机交易`);

    const moneyAnser = await input.default({
      message: "请输入交易随机代币比例，格式为 数字%-数字%，默认可不填",
      default: "40%-70%",
      validate: function (value) {
        const pass = value.match(/^\d+%-\d+%$/);
        if (pass) {
          const numbers = value.split("-").map((num) => parseInt(num, 10));
          if (numbers[0] < numbers[1]) {
            return true;
          }
          return "第一个数字必须小于第二个数字！";
        }
        return '请输入正确格式的字符串（例如 "12%-43%"）！';
      },
    });
    console.log(`已选${moneyAnser}比例 随机交易`);

    let randomAnserArr = randomAnser.split("-").map(Number);
    randomAnserArr = Array.from(
      { length: randomAnserArr[1] - randomAnserArr[0] + 1 },
      (_, index) => index + randomAnserArr[0]
    );
    let moneyAnserArr = moneyAnser.split("-").map((s) => parseInt(s, 10));
    moneyAnserArr = Array.from(
      { length: moneyAnserArr[1] - moneyAnserArr[0] + 1 },
      (_, index) => index + moneyAnserArr[0]
    );

    const apisecret = process.env.BACKPACK_API_SECRET;
    const apikey = process.env.BACKPACK_API_KEY;

    if (!apisecret || !apikey) {
      throw new Error("API 密钥未在环境变量中设置");
    }
    const client = new backpack_client_1.BackpackClient(apisecret, apikey);
    init(client, tokenAnswer, randomAnserArr, moneyAnserArr);
  } catch (error) {
    console.error("程序执行出错:", error);
  }
})();
