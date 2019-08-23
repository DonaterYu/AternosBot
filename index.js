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
  rejoin = true,
  mc = require("minecraft-protocol");

if (process.env.dsbot) {
  let Discord = require("discord.js"),
    DSclient = new Discord.Client();

  DSclient.once("ready", () => {
    console.log("Я зашёл в дискорд сервер.");
  });

  DSclient.on("message", message => {
    if (message.author.username == DSclient.user.username)
      if (message.channel.name != "minecraft-bot") return;
    const args = message.content
      .slice(1)
      .trim()
      .split(/ +/g);
    if (!args[0].toLowerCase().startsWith("написать")) return;
    let text = args
      .slice(1)
      .toString()
      .replace(/,/g, " ");
    client.write("chat", { message: text });
    console.log(`Сообщение через Discord: ${text}`);
    message.channel.send("Успешно отправил сообщение!");
  });

  DSclient.login(process.env.dsbot);
}

const sleep = ms => {
  return new Promise(resolve => setTimeout(resolve, ms));
};
const translateBoolean = boolean => {
  return boolean === true ? "Да" : boolean === false ? "Нет" : null;
};
const startmc = (server, username) => {
  return mc.createClient({
    host: server,
    port: process.env.port ? process.env.port : null,
    username: username,
    password: process.env.password
      ? process.env.password
      : process.argv[4]
      ? process.argv[4]
      : null
  });
};
const msToSeconds = ms => {
  return ms / 1000;
};
let client = startmc(
  process.env.server ? process.env.server : process.argv[2],
  process.env.nick
    ? process.env.nick
    : process.argv[3]
    ? process.argv[3]
    : "AternosBot"
);

const bindEvents = () => {
  client.on("error", err => {
    switch (err) {
      case "Error: Invalid credentials. Invalid username or password.":
        console.log(
          `Неверный логин [${process.argv[3]}] или пароль [${
            process.argv[4]
          }] от аккаунта!`
        );
        process.exit(1);
        break;
      case `Error: getaddrinfo ENOTFOUND ${process.argv[2]}`:
        console.log(`Неправильный IP адресс сервера! [${process.argv[2]}]`);
        process.exit(1);
        break;
      case "TypeError: Cannot read property 'name' of undefined":
        console.log("Сервер ещё запускается. Попробуйте позже.");
        process.exit(1);
        break;
      default:
        console.log(err);
    }
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
  client.on("kick_disconnect", packet => {
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
      (awaitingCustomInput = false), (moveTimeoutActive = true);
      client = startmc(
        process.env.server ? process.env.server : process.argv[2],
        process.env.nick
          ? process.env.nick
          : process.argv[3]
          ? process.argv[3]
          : "AternosBot"
      );
      bindEvents();
      return;
    }
    if (rejoin) {
      client.end();
      (awaitingCustomInput = false), (moveTimeoutActive = true);
      client = startmc(
        process.env.server ? process.env.server : process.argv[2],
        process.env.nick
          ? process.env.nick
          : process.argv[3]
          ? process.argv[3]
          : "AternosBot"
      );
      bindEvents();
    } else {
      process.exit(1);
    }
  });
  client.on("position", packet => {
    client.position = packet;
  });
  client.on("chat", async packet => {
    let parsedMessage = JSON.parse(packet.message);
    console.log(parsedMessage);
    if (process.env.debug) console.log(parsedMessage);
    if (
      parsedMessage.translate != "chat.type.text" ||
      parsedMessage.with[0].text == client.username
    )
      return;
    let message = {
      text: parsedMessage.with[1],
      author: `<${parsedMessage.with[0].text}>`
    };
    console.log(message.author + " | " + message.text);
    if (awaitingCustomInput && awaitingCustomInput == "moveDelay") {
      if (isNaN(message.text))
        return client.write("chat", {
          message: `Значение "${message.text}" не является числом!`
        });
      client.write("chat", {
        message: "Указано новое значение для настройки: Задержка движения"
      });
      await sleep(100);
      client.write("chat", {
        message: `(старое значение: ${msToSeconds(
          moveDelay
        )}с, новое значение: ${message.text}с)`
      });
      (moveDelay = message.text * 1000), (awaitingCustomInput = false);
    }
    if (awaitingCustomInput && awaitingCustomInput == "nick") {
      client.write("chat", {
        message: "Указано новое значение для настройки: Ник"
      });
      await sleep(100);
      client.write("chat", {
        message: `(старое значение: ${client.username}, новое значение: ${message.text})`
      });
      await sleep(100);
      (awaitingCustomInput = false), (moveTimeoutActive = true);
      client.end();
      client = startmc(
        process.env.server ? process.env.server : process.argv[2],
        message.text
      );
      bindEvents();
    }
    if (awaitingInput && message.text == "1") {
      client.write("chat", {
        message: `Выбрана настройка: Задержка движения (значение: ${msToSeconds(
          moveDelay
        )}с)`
      });
      await sleep(100);
      client.write("chat", { message: "Укажите новое значение для настройки" });
      awaitingCustomInput = "moveDelay";
      return (awaitingInput = false);
    }
    if (awaitingInput && message.text == "2") {
      if (process.argv[4])
        return client.write("chat", {
          message: "Сменить ник на лицензионном сервере нельзя."
        });
      client.write("chat", {
        message: `Выбрана настройка: Ник (значение: ${client.username})`
      });
      await sleep(100);
      client.write("chat", { message: "Укажите новое значение для настройки" });
      awaitingCustomInput = "nick";
      return (awaitingInput = false);
    }
    if (awaitingInput && message.text == "3") {
      client.write("chat", {
        message: "Указано новое значение для настройки: Задержка движения"
      });
      await sleep(100);
      client.write("chat", {
        message: `(старое значение: ${translateBoolean(
          rejoin
        )}, новое значение: ${translateBoolean(!rejoin)})`
      });
      rejoin = !rejoin;
      return (awaitingInput = false);
    }
    if (awaitingInput) if (!message.text.startsWith("$")) return;
    switch (message.text.slice(1).toLowerCase()) {
      case "двигайся":
        moveTimeoutActive = true;
        const move = () => {
          if (!moveTimeoutActive) return;
          setTimeout(() => {
            let dir = Math.floor(Math.random() * (100 - 0));
            const changePosition = (packet, direction) => {
              const newpacket = {
                x:
                  direction > 75
                    ? packet.x + 0.5
                    : direction > 50
                    ? packet.x - 0.5
                    : packet.x,
                y: packet.y,
                z:
                  direction < 25
                    ? packet.z + 0.5
                    : direction < 50
                    ? packet.z - 0.5
                    : packet.z,
                yaw: 0,
                pitch: 0,
                flags: 0,
                teleportId: packet.teleportId
              };
              client.write("position", newpacket);
              client.write("teleport_confirm", {
                teleportId: packet.teleportId
              });
              return newpacket;
            };
            client.position = changePosition(
              {
                x: client.position.x,
                y: client.position.y,
                z: client.position.z,
                teleportId: client.position.teleportId
              },
              dir
            );
            move();
          }, moveDelay);
        };
        move();
        client.write("chat", { message: "Начинаю двигаться..." });
        await sleep(100);
        client.write("chat", {
          message: `Задержка движения: ${msToSeconds(moveDelay)} секунд`
        });
        await sleep(100);
        client.write("chat", {
          message: 'Изменить значение можно прописав "$Настройки".'
        });
        await sleep(100);
        client.write("chat", {
          message: 'Остановить движение можно прописав "$Стоп".'
        });
        break;
      case "двигайся-круг":
        const moveInCircle = () => {

        }
        const calculateCoordinates = (originalCoordinates) => {
          let { x, y, z } = originalCoordinates
          let newX = x + 2
        }
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
        await sleep(100);
        client.write("chat", {
          message: `1. Задержка движения = ${msToSeconds(moveDelay)} секунд`
        });
        await sleep(100);
        client.write("chat", { message: `2. Ник = ${client.username}` });
        await sleep(100);
        client.write("chat", {
          message: `3. Автоматический перезаход = ${translateBoolean(rejoin)}`
        });
        await sleep(100);
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
