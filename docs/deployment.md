# Размещение bxDash в Bitrix и запуск приложения

Пример адреса приложения: `https://bitrix.domain.local/dashboard/v1/`.
Здесь `/dashboard/v1/` — каталог собранного frontend, а
`/dashboard/back/api/` — отдельный адрес PHP API bxDash внутри Bitrix.
Имена каталогов можно выбрать другие, согласовав пути сборки, конфиг и маршрутизацию.

## DEV через локальный nginx

В каждом виртуальном хосте nginx подставляет свой `config.priv.js` и
проксирует публичный путь дашборда в соответствующий локальный Vite.
Vite отдаёт HTML и обслуживает HMR. Запросы к `/bitrix/`, страницам задач
и API направляются по обычным правилам в Bitrix соответствующего домена.

В локальном конфиге укажите `apiUrl` текущего домена, например
`'/reviakin/back/api/'`. После входа браузер запрашивает
`/reviakin/back/api/portal/resources`. Тот же относительный адрес на двух
доменах попадает в API двух разных порталов. [Подключение ресурсов и проверка](bitrix-resources.md)

## 1. Размещение файлов и конфигурация Apache/nginx

```text
DOCUMENT_ROOT/                           # Корень уже установленного сайта Bitrix
├── bitrix/                              # Существующее ядро; сюда bxDash не копируем
└── dashboard/
    ├── v1/                              # Содержимое build/ после npm run build
    │   ├── index.html                   # HTML собранного frontend
    │   ├── assets/                      # Собранные JS/CSS: приложение работает в браузере
    │   ├── config.priv.js               # Браузерный конфиг: URL backend-систем и настройки UI
    │   └── ...                          # Иконки, шрифты и остальные файлы build/
    └── back/                            # Содержимое back/; публикуется отдельно от build/
        ├── .htaccess                    # Apache: api/* → api.php
        ├── api.php                      # Точка входа PHP API bxDash
        ├── conf.example.php             # Образец серверного конфига
        ├── conf.php                     # ID инфоблоков, провайдер колонок и настройки API
        └── app/
            ├── router.php               # Разбор маршрута и вызов контроллера
            ├── ctl/                     # Контроллеры запросов
            └── models/                  # Провайдеры и серверная логика
```

Настройки веб-сервера находятся отдельно от дерева приложения. Ниже показаны
две альтернативы; конкретное имя файла виртуального хоста зависит от установки.

```text
Конфигурация веб-сервера сайта bitrix.domain.local
├── Apache — виртуальный хост сайта
│   ├── Каталог DOCUMENT_ROOT/dashboard/v1/
│   │   └── DirectoryIndex index.html
│   ├── Каталог DOCUMENT_ROOT/dashboard/back/
│   │   └── Разрешены mod_rewrite и обработка опубликованного .htaccess
│   └── Существующий обработчик PHP Bitrix обслуживает api.php
└── nginx — блок server сайта
    ├── Каталог /dashboard/v1/
    │   └── index index.html
    ├── Маршрут /dashboard/back/api/*
    │   └── Передача в /dashboard/back/api.php с сохранением исходного URI
    ├── Существующий обработчик PHP/FastCGI Bitrix обслуживает PHP-точки входа
    └── .htaccess не используется; правило API задаётся в конфигурации nginx
```

`npm run build` создаёт статическую сборку. Каталог `back/` публикуют отдельно.

| Настройка | Где находится после публикации | Кто читает |
| --- | --- | --- |
| `base` Vite | При сборке задаётся в `vite.config.js` | Vite формирует URL ресурсов |
| `config.priv.js` | `/dashboard/v1/config.priv.js` | Браузер; файл доступен посетителю |
| `conf.php` | Рядом с `/dashboard/back/api.php` | PHP API, в том числе профиль ресурсов Bitrix |
| Индекс каталога и rewrite | Конфигурация виртуального хоста или разрешённый `.htaccess` | Apache/nginx |

В `config.priv.js` для этого примера:

```js
window.__CONFIG__ = {
	apiUrl: 'https://bitrix.domain.local/dashboard/back/api/',
	inventoryUrl: 'https://inventory.domain.local/',
	zabbixUrl: 'https://zabbix.domain.local/',
	wsUrl: false,
	asteriskUrl: false,
	userList: [], // Заполнить сотрудниками своего развёртывания.
};
```

Это фрагмент для объяснения адресов. Полный образец настроек —
[`public/config.priv.example.js`](../public/config.priv.example.js).
Это базовые адреса: helper Inventory добавляет `api/users/search`, helper
Zabbix — `api_jsonrpc.php`. Если сервис опубликован в подкаталоге, включите
его в базовый адрес. Указывайте завершающий `/`, поскольку пути запросов
добавляются к этим строкам и к `apiUrl`.
Пользовательские учётные данные вводятся в интерфейсе. `config.priv.js`
загружается в браузер, поэтому серверные секреты в нём не хранят.

Для адреса `/dashboard/v1/` настройте индекс `index.html`.
После обновления старой установки переключите индекс фронтенда с PHP на HTML
и перенесите профиль библиотек в `back/conf.php`. [Шаги обновления](bitrix-resources.md#обновление-размещения)

Apache использует опубликованный `back/.htaccess`, если разрешены rewrite и
чтение `.htaccess`. Nginx `.htaccess` не читает: правило передачи
`/dashboard/back/api/*` в `/dashboard/back/api.php` нужно задать в виртуальном
хосте, сохранив исходный URI запроса. У текущего роутера фиксированное
смещение пути `router::$num_shift = 3`: пример `/dashboard/back/api/task/load/...`
ему соответствует. При другой глубине URL нужно согласовать смещение
в `back/app/router.php` или способ передачи параметров маршрута.

`api.php` подключает пролог установленного Bitrix. Настройки приложения
хранятся в его собственных файлах, подключение к БД выполняется средствами портала.

## 2. Последовательность обращений при инициализации

```mermaid
sequenceDiagram
    actor User as Пользователь
    participant Browser as Браузер: React и MobX
    participant Web as Веб-сервер Bitrix
    participant API as PHP API bxDash
    participant BX as Bitrix backend
    participant Other as Inventory / Zabbix
    participant Extra as ast22 / WebSocket

    User->>Browser: Открывает bitrix.domain.local/dashboard/v1/
    Browser->>Web: GET /dashboard/v1/
    Web-->>Browser: index.html со ссылками на сборку
    Browser->>Web: GET config.priv.js и JS/CSS сборки
    Web-->>Browser: Конфиг с адресами backend-систем и статические файлы
    Browser->>Browser: Запуск React, инициализация, форма входа
    Note over User,Browser: Приложение работает в браузере.<br/>Node.js/Vite на сервере для готовой сборки не нужны.
    Note over Browser,Extra: Проверки доступности бэков могут начинаются до ввода учётных данных. После ввода учетные данные передаются только в доступные бэки

    User->>Browser: Вводит логин и пароль
    Note over Browser,Extra: JS приложение работающее в браузере использует предоставленные учетные данные для получения данных из бэков
    par Bitrix
        Browser->>API: POST user/login
        API->>BX: Проверка учётных данных
        BX-->>API: Результат входа
        API-->>Browser: JSON с auth и ID пользователя
    
        Browser->>Other: Авторизация отдельно в Inventory и Zabbix
        Other-->>Browser: Результаты, токен Zabbix при успехе
    and Необязательная телефония
        opt ast22 включён в конфигурации
            Browser->>Extra: Авторизация ast22
            Extra-->>Browser: Результат и токен при успехе
        end
    end

    Browser->>API: GET portal/resources
    API-->>Browser: CSS и JavaScript для установленного Bitrix
    Browser->>API: Загрузка задач, работ, планов, заметок и колонок
    Note over Browser,API: Запросы Bitrix API после входа используют HTTP Basic over HTTPS.
    API->>BX: Чтение данных с правами пользователя
    BX-->>API: Данные
    API-->>Browser: JSON
    Browser->>Other: Запросы данных напрямую в Inventory и Zabbix
    Other-->>Browser: Ответы соответствующих API
    opt WebSocket включён в конфигурации
        Browser->>Extra: WS-соединение
        Extra-->>Browser: События изменений
    end
    Browser->>Browser: Раскладка и отрисовка карточек
    Browser-->>User: Dashboard готов к работе
```

Frontend сам обращается к каждому backend по адресу из конфигурации.
PHP API bxDash обслуживает операции Bitrix; он не является общим прокси
авторизации Inventory, Zabbix или ast22. При разных origin серверы сервисов
должны разрешать необходимые браузерные запросы через CORS, включая заголовок
`Authorization`, где он используется.

Начало загрузки данных привязано к готовности соответствующей системы:
например, справочник категорий заявок загружается после авторизации Bitrix.
Схема показывает успешный запуск; при ошибках входа интерфейс получает
статус ошибки соответствующего backend. Телефония и WebSocket отключаются
значением `false`; обязательными системами остаются Bitrix, Inventory и Zabbix.

PHP на сервере выполняется при запросах API. React,
MobX, раскладка карточек и обработка пользовательских действий выполняются
в браузере. Страницы задач/заявок, открываемые в iframe, отдельно обслуживает
Bitrix: для них важны сессия портала, его ресурсы и одинаковый origin при
обращении к `parent.BX`.

Связанные инструкции: [ресурсы и профили Bitrix](bitrix-resources.md),
[инфоблоки](bitrix-iblocks.md), [режимы канбан-колонок](bitrix-kanban.md).
