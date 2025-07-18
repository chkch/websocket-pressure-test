#!/usr/bin/env node

// +-------------------------------------------------------------------------
// | webSocket并发压力测试
// +-------------------------------------------------------------------------

const clc = require('cli-color');
const WebSocketClient = require('websocket').client;
const fs = require('fs');
let count = 0;
let failed = 0;
let errorCount = 0; 
let close = 0;

// 增加接收訊息量的計數器
let messageReceived = 0;

const url = process.argv[2] || 'ws://127.0.0.1:9502';
const c = process.argv[3] || 10000;

// 新增一個自訂參數，可以讀取json檔案中的訊息，並透過WS發送
var customData = process.argv[4] || false;
var fileContents;
var customJSON;
try {
    fileContents = fs.readFileSync(customData);
    customJSON = JSON.parse(fileContents);
} catch (err) {
    customData = false;
    customJSON = null;
}

const connectList = [];

for (let i = 1; i <= c; i++) {
    ws(i);
}

function ws(i) {
    const client = new WebSocketClient();

    connectList[i] = client;

    client.on('connectFailed', function (error) {
        failed++;
        state();
        console.log('Connect Error: ' + error.toString());
    });

    client.on('connect', function (connection) {
        count++;
        state();
        connection.on('error', function (error) {
            errorCount++;
            state();
        });
        connection.on('close', function () {
            close++;
            state();
        });
        connection.on('message', function (message) {
            messageReceived++;
            state();
        });

        // 檢查，若有自訂訊息，則傳送自訂訊息，若否，則使用原本預定的數字傳送
        if (!customData) {
            function sendNumber() {
                if (connection.connected) {
                    const number = Math.round(Math.random() * 0xFFFFFF);
                    connection.sendUTF(number.toString());
                    setTimeout(sendNumber, 1000);
                }
            }
            sendNumber();
        } else {
            //以字串方式傳送自訂訊息
            function sendMyMessage() {
                // 在有連線的情況下才送出訊息
                if (connection.connected) {
                    if (Array.isArray(customJSON)) {
                        customJSON.forEach((item) => {
                            connection.send(JSON.stringify(item));
                        });
                    } else {
                        connection.send(JSON.stringify(customJSON));
                    }
                } else {
                    //若連線尚未建立，等待一秒後再送一次
                    setTimeout(sendMyMessage, 1000);
                }
            }
            sendMyMessage();
        }

    });
    client.connect(url);
}

let lastPrintTime = Date.now();
const printInterval = 1000; // 每秒打印一次连接信息

function state() {
    const now = Date.now();
    if (now - lastPrintTime >= printInterval) {
        process.stdout.write(clc.move.top);
        console.debug(
            clc.green('连接成功:') + clc.white(count),
            clc.yellow('连接失败:') + clc.white(failed),
            clc.magenta('连接错误:') + clc.white(errorCount),
            clc.yellow('连接关闭:') + clc.white(close),
            clc.red('已接收訊息:') + clc.white(messageReceived)
        );
        lastPrintTime = now;
    }
}

function closeAll(){
    for (let i = 1; i <= c; i++) {
        if (connectList[i]) {
            connectList[i].abort();
        }
    }
    // console.debug( clc.green('结束') );
    process.exit(0);
}

// 捕获 SIGINT 信号（Ctrl + C）
process.on('SIGINT', () => {
    // console.log('\n收到 Ctrl + C 信号，正在关闭所有连接...');
    closeAll();
});
