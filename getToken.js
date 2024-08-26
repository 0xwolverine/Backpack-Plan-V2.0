const https = require("https");
const fs = require("fs");

// 使用 https 模块获取 API 数据
function getAssets() {
  return new Promise((resolve, reject) => {
    https
      .get("https://api.backpack.exchange/api/v1/assets", (res) => {
        let data = "";

        res.on("data", (chunk) => {
          data += chunk;
        });

        res.on("end", () => {
          try {
            const jsonData = JSON.parse(data);
            resolve(jsonData);
          } catch (error) {
            reject(new Error("解析 JSON 数据时出错"));
          }
        });
      })
      .on("error", (error) => {
        reject(new Error(`获取数据时出错: ${error.message}`));
      });
  });
}

// 处理数据并生成 tokenList
function generateTokenList(assets) {
  const tokenList = {
    message: `
    选择刷量的币种，会随机刷选择的代币。
  ！确保backpack有大于5USDC数量。
  ！确保选择的币种backpack有一定余额数量，否则会报错。
  ！如果刷sol，请确保backpack有一定数量的sol，其他代币同理。
  《按键盘空格是选择，回车是确认》
    `,
    choices: [],
  };

  assets.forEach((asset) => {
    if (asset.symbol !== "USDC") {
      tokenList.choices.push({
        name: `${asset.symbol}_USDC`,
        value: `${asset.symbol}_USDC`,
        description: `${asset.symbol}_USDC`,
      });
    }
  });

  return tokenList;
}

// 将数据保存为 JSON 文件
function saveToJsonFile(data, filename) {
  return new Promise((resolve, reject) => {
    const jsonData = JSON.stringify(data, null, 2);
    fs.writeFile(filename, jsonData, "utf8", (err) => {
      if (err) {
        reject(new Error(`保存文件时出错: ${err.message}`));
      } else {
        resolve(`数据已成功保存到 ${filename}`);
      }
    });
  });
}

// 主函数
async function main() {
  try {
    const assets = await getAssets();
    const tokenList = generateTokenList(assets);

    // 保存到 JSON 文件
    const filename = "tokenList.json";
    const saveResult = await saveToJsonFile(tokenList, filename);
    console.log(saveResult);

    // 在控制台打印结果
    console.log("生成的 tokenList:");
    console.log(JSON.stringify(tokenList, null, 2));
  } catch (error) {
    console.error("处理过程中出错:", error);
  }
}

// 运行主函数
main();
