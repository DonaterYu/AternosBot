var mc = require("minecraft-protocol");
if (
  (process.argv.length < 3 || process.argv.length > 6) &&
  !process.env.server
) {
  console.log(
    "Используйте бота так: node index.js <IP адрес сервера> [<имя аккаунта>] [<пароль от аккаунта>]"
  );
  process.exit(1);
}
let moveDelay = 10000,
    awaitingInput = false,
    awaitingCustomInput = false,
    moveTimeoutActive = false,
    rejoin = true;

if (process.env.dsbot) {
  let Discord = require("discord.js"),
      DSclient = new Discord.Client();

  DSclient.once("ready", () => {
    console.log("Я зашёл в дискорд сервер.");
  });

  DSclient.on("message", (message) => {
    if (message.author.username == DSclient.user.username)
    if (message.channel.name != "minecraft-bot") return;
    const args = message.content.slice(1).trim().split(/ +/g);
    if (!args[0].toLowerCase().startsWith("написать")) return;
    let text = args.slice(1).toString().replace(/,/g, " ");
    client.write("chat", { message: text });
    console.log(`Сообщение через Discord: ${text}`);
    message.channel.send("Успешно отправил сообщение!");
  })

  DSclient.login(process.env.dsbot)
};

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
};
function translateBoolean(boolean) {
  return boolean === true ? "Да" : boolean === false ? "Нет" : null;
};
function startmc(server, username) {
  return mc.createClient({
    host: server,
    port: process.env.port ? process.env.port : null,
    username: username,
    password: process.env.password ? process.env.password : process.argv[4] ? process.argv[4] : null
  });
};
function msToSeconds(ms) {
  return ms / 1000;
};
var client = startmc(
  process.env.server ? process.env.server : process.argv[2],
  process.env.nick ? process.env.nick : process.argv[3] ? process.argv[3] : "AternosBot"
);

function bindEvents() {
  client.on("error", err => {
    if (err == "Error: Invalid credentials. Invalid username or password.") {
      console.log(
        `Неверный логин [${process.argv[3]}] или пароль [${
          process.argv[4]
        }] от аккаунта!`
      );
      process.exit(1);
    }
    if (err == `Error: getaddrinfo ENOTFOUND ${process.argv[2]}`) {
      console.log(`Неправильный IP адресс сервера! [${process.argv[2]}]`);
      process.exit(1);
    }
    if (err == 'TypeError: Cannot read property \'name\' of undefined') {
      console.log('Сервер ещё запускается. Попробуйте позже.');
      process.exit(1);
    }
    console.log(err);
  });
  client.on("connect", () => {
    console.log(
      `Пытаюсь зайти на сервер ${
        process.env.server ? process.env.server : process.argv[2]
      } под ником ${client.username} ${
        process.argv[4] ? "(лицензия)..." : "(пиратка)..."
      }`
    );
  });
  client.on("packet", packet => {
    if (!packet.reason || !JSON.parse(packet.reason).translate) return;
    if (
      packet.reason &&
      packet.reason.match("You are trying to connect to") &&
      packet.reason.match("This server is offline")
    )
      return console.log("Сервер выключен!");
    console.log(
      "Бот вышел с сервера. Причина: " + JSON.parse(packet.reason).translate
    );
    if (
      JSON.parse(packet.reason).translate ==
      "multiplayer.disconnect.duplicate_login"
    ) {
      client.end();
      client = startmc(
        process.env.server ? process.env.server : process.argv[2],
        process.env.nick ? process.env.nick : process.argv[3] ? process.argv[3] : "AternosBot"
      );
      bindEvents();
      return;
    }
    if (rejoin) {
      client.end();
      client = startmc(
        process.env.server ? process.env.server : process.argv[2],
        process.env.nick ? process.env.nick : process.argv[3] ? process.argv[3] : "AternosBot"
      );
      bindEvents();
    } else {
      process.exit(1);
    }
  });
  client.on("chat", packet => {
    var jsonMsg = JSON.parse(packet.message);
    if (!jsonMsg.extra && !jsonMsg.with) return;
    if (
      jsonMsg.extra &&
      jsonMsg.extra[0].translate == "command.unknown.command" &&
      moveTimeoutActive == true
    ) {
      moveTimeoutActive = false;
      client.write("chat", {
        message: `У меня недостаточно прав для движения! Выдайте мне права администратора (/op ${
          client.username
        })`
      });
      return client.write("chat", { message: "Движение бота остановлено." });
    }
    if (
      (jsonMsg.extra &&
        jsonMsg.extra[0].color == "gray" &&
        jsonMsg.extra[0].text == "") ||
      (jsonMsg.extra && jsonMsg.extra[0].translate == "command.unknown.command")
    )
      return;
    var text = jsonMsg.extra
      ? jsonMsg.extra[0].text
      : jsonMsg.translate == 'multiplayer.player.joined' 
      ? `${jsonMsg.with[0].text} зашёл на сервер` 
      : jsonMsg.translate == 'multiplayer.player.left' 
      ? `${jsonMsg.with[0].text} вышел с сервера`
      : `<${jsonMsg.with[0].text}> ${jsonMsg.with[1]}`;
    if (text.startsWith(`<${client.username}>`)) return;
    console.log(`Сообщение в чате: ${text}`);
    text = text.replace(/<.*> /, "");
    if (awaitingCustomInput && awaitingCustomInput == "moveDelay") {
      if (isNaN(text))
        return client.write("chat", {
          message: `Значение "${text}" не является числом!`
        });
      client.write("chat", {
        message: `Указано новое значение для настройки: Задержка движения`
      });
      sleep(500);
      client.write("chat", {
        message: `(старое значение: ${msToSeconds(
          moveDelay
        )}с, новое значение: ${text}с)`
      });
      moveDelay = text * 1000;
      awaitingCustomInput = false;
    }
    if (awaitingCustomInput && awaitingCustomInput == "nick") {
      client.write("chat", {
        message: `Указано новое значение для настройки: Ник`
      });
      sleep(500);
      client.write("chat", {
        message: `(старое значение: ${
          client.username
        }, новое значение: ${text})`
      });
      sleep(500);
      awaitingCustomInput = false;
      client.end();
      client = startmc(
        process.env.server ? process.env.server : process.argv[2],
        text
      );
      bindEvents();
    }
    if (awaitingInput && text == "1") {
      client.write("chat", {
        message: `Выбрана настройка: Задержка движения (значение: ${msToSeconds(
          moveDelay
        )}с)`
      });
      sleep(500);
      client.write("chat", { message: "Укажите новое значение для настройки" });
      awaitingCustomInput = "moveDelay";
      return (awaitingInput = false);
    }
    if (awaitingInput && text == "2") {
      if (process.argv[4])
        return client.write("chat", {
          message: `Сменить ник на лицензионном сервере нельзя.`
        });
      client.write("chat", {
        message: `Выбрана настройка: Ник (значение: ${client.username})`
      });
      sleep(500);
      client.write("chat", { message: "Укажите новое значение для настройки" });
      awaitingCustomInput = "nick";
      return (awaitingInput = false);
    }
    if (awaitingInput && text == "3") {
      client.write("chat", {
        message: `Указано новое значение для настройки: Задержка движения`
      });
      sleep(500);
      client.write("chat", {
        message: `(старое значение: ${translateBoolean(
          rejoin
        )}, новое значение: ${translateBoolean(!rejoin)})`
      });
      rejoin = !rejoin;
      return (awaitingInput = false);
    }
    if (awaitingInput) if (!text.startsWith("$")) return;
    switch (text.slice(1).toLowerCase()) {
      case "двигайся":
        moveTimeoutActive = true;
        function move() {
          if (!moveTimeoutActive) return;
          setTimeout(function() {
            let dir = Math.floor(Math.random() * (100 - 0)) + 0;
            let direction =
              dir > 75
                ? "~0.5 ~ ~"
                : dir > 50
                ? "~ ~ ~0.5"
                : dir > 25
                ? "~-0.5 ~ ~"
                : "~ ~ ~-0.5";
            client.write("chat", {
              message: `/tp ${client.username} ${direction}`
            });
            move();
          }, moveDelay);
        }
        move();
        client.write("chat", { message: "Начинаю двигаться..." });
        sleep(500);
        client.write("chat", {
          message: `Задержка движения: ${msToSeconds(moveDelay)} секунд`
        });
        sleep(500);
        client.write("chat", {
          message: 'Изменить значение можно прописав "$Настройки".'
        });
        sleep(500);
        client.write("chat", {
          message: 'Остановить движение можно прописав "$Стоп".'
        });
        break;
      case "стоп":
        if (!moveTimeoutActive)
          return client.write("chat", { message: "Бот не двигается." });
        moveTimeoutActive = false;
        client.write("chat", { message: `Движение бота остановлено.` });
        break;
      case "настройки":
        if (awaitingInput) {
          awaitingInput = false;
          return client.write("chat", { message: "Отменил выбор настроек." });
        }
        if (awaitingCustomInput) {
          awaitingCustomInput = false;
          return client.write("chat", {
            message: "Отменил измение настройки."
          });
        }
        client.write("chat", {
          message:
            "Выберите настройку, которую хотите изменить (введите номер настройки):"
        });
        sleep(500);
        client.write("chat", {
          message: `1. Задержка движения = ${msToSeconds(moveDelay)} секунд`
        });
        sleep(500);
        client.write("chat", { message: `2. Ник = ${client.username}` });
        sleep(500);
        client.write("chat", {
          message: `3. Автоматический перезаход = ${translateBoolean(rejoin)}`
        });
        sleep(500);
        client.write("chat", {
          message: 'Чтобы отменить изменение настроек, пропишите "$Отмена".'
        });
        awaitingInput = true;
        break;

      case "отмена":
        if (awaitingInput) {
          awaitingInput = false;
          return client.write("chat", { message: "Отменил выбор настроек." });
        }
        if (awaitingCustomInput) {
          awaitingCustomInput = false;
          return client.write("chat", {
            message: "Отменил измение настройки."
          });
        }
        client.write("chat", { message: "Нечего отменять." });
        break;
    }
  });
};
bindEvents();
