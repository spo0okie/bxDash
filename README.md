
# dashboard

Собственно dashboard с попыткой написать его на react.js  

для управления данными используется mobX  
[https://habr.com/ru/articles/471048/]  

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

## Available Scripts

In the project directory, you can run:

### `npm start`

Runs the app in the development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in your browser.

The page will reload when you make changes.\
You may also see any lint errors in the console.

### `npm test`

Launches the test runner in the interactive watch mode.\
See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

### `npm run build`

Builds the app for production to the `build` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.\
Your app is ready to be deployed!

See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.

### `npm run eject`

**Note: this is a one-way operation. Once you `eject`, you can't go back!**

If you aren't satisfied with the build tool and configuration choices, you can `eject` at any time. This command will remove the single build dependency from your project.

Instead, it will copy all the configuration files and the transitive dependencies (webpack, Babel, ESLint, etc) right into your project so you have full control over them. All of the commands except `eject` will still work, but they will point to the copied scripts so you can tweak them. At this point you're on your own.

You don't have to ever use `eject`. The curated feature set is suitable for small and middle deployments, and you shouldn't feel obligated to use this feature. However we understand that this tool wouldn't be useful if you couldn't customize it when you are ready for it.

## Learn More

You can learn more in the [Create React App documentation](https://facebook.github.io/create-react-app/docs/getting-started).

To learn React, check out the [React documentation](https://reactjs.org/).

### Code Splitting

This section has moved here: [https://facebook.github.io/create-react-app/docs/code-splitting](https://facebook.github.io/create-react-app/docs/code-splitting)

### Analyzing the Bundle Size

This section has moved here: [https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size](https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size)

### Making a Progressive Web App

This section has moved here: [https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app](https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app)

### Advanced Configuration

This section has moved here: [https://facebook.github.io/create-react-app/docs/advanced-configuration](https://facebook.github.io/create-react-app/docs/advanced-configuration)

### Deployment

This section has moved here: [https://facebook.github.io/create-react-app/docs/deployment](https://facebook.github.io/create-react-app/docs/deployment)

### `npm run build` fails to minify

This section has moved here: [https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify](https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify)

----
### Cokies

[https://github.com/js-cookie/js-cookie](js-cookie)

### ТЗ

* согласно разметке у нас есть логическая сетка по одной оси пользователи, по другой периоды
* каждый элемент падает в одну из комбинаций (пользователь,период)
* периоды для удобства форматирования складываются внутрь интервалов (дни в недели, чтобы можно было рисовать календарь по одному пользователю)
  * т.е. у интервала есть рамки и он внутри себя отображает все "свои" периоды - те которые в него умещаются
* Возможность добавлять (и убирать) недели в календарь
  * [ ] Добавление в начало календаря подразумевает также подгрузку данных на эту неделю
  * [ ] Добавление недели в конец календаря подразумевает перенос уже загруженных данных из "долгого ящика"
* Возможность смотреть данные в разных раскладках
  * [x] раскладка все пользователи с разбивкой по дням
  * [x] раскладка все пользователи с разбивкой по неделям
  * [x] раскладка один пользователь с разбивкой по дням
  * [x] раскладка один пользователь с разбивкой по неделям
* [x] Все элементы со статусом *переназначаемые* (не закрытые задачи и работы) можно двигать:
  * [X] по сетке со сменой срока дедлайна (если роняем в ячейку с другой датой) и сменой ответственного (если роняем в ячейку другого пользователя)
  * [x] в пределах ячейки для смены приоритета (сортировка)
* [x] Все изменения объектов кидаются в WS канал, чтобы все подключенные пользователи оперативно видели изменения
  * [x] Все изменения опубликованные в WS канале оперативно отображаются
* [x] Настройки интерфейса сохраняются между перезапусками в куках
* [x] Раз в 2 минуты надо проверять тикеты и задачи на предмет изменений
* [ ] Ссылки на другие объекты парсятся только когда все данные уже загружены (ждут окончания загрузки)
* [ ] Объекты с нераспознанными ссылками помечаются и повторно распознают ссылки если были подгружены новые данные

#### Планы

* [x] Отображаются всегда вверху ячейки
* [x] Вешаются всегда на конец недели
* [x] Нельзя двигать
* [x] Нельзя создавать в долгом ящике
* [x] После подтверждения нельзя менять заголовок, только комментарии

#### Задачи

* [x] Раскидываются по сетке
  * [x] Возможность отображать или скрывать задачи, в которых пользователь не ответственный, а соисполнитель
* [x] По клику открываются в модальном окне
* [x] Выделяет звездочкой "избранные"
* [x] При наведении мыши на задачу - выделяет связанные задачи (родительскую, дочерние), работы по задаче
* [x] При клике на статус - можно запустить/остановить задачу
* [x] При наведении мыши на дедлайн показывает также дату создания задачи
* [x] Можно создавать прямо из интерфейса (со значениями по умолчанию)
* [x] Если задача в работе, то ее помещаем в ячейку на сегодня
* [ ] Если к задаче прикреплены планы, то ее срок считаем как MIN (самый первый непросроченный план, крайний срок задачи), т.е. пододвигаем задачи вверх

#### Заявки (Тикеты)

* [x] Раскидываются по сетке
* [x] По клику открываются в модельном iframe
* [x] Drag-n-drop отключен. Все движения только через интерфейс Битрикс.
* [ ] Считается затраченное рабочее время на закрытие тикета

#### Работы

* [x] Раскладываются по сетке
* [x] Возможность скрывать работы по кнопке в меню
* [ ] Возможность привязываться к задачам/заявкам

#### Сотрудники

* [ ] Отображаются имена и телефоны
* [ ] Отображается статус дежурного телефона
* [ ] Отображается статус дежурного на заявках в портале
* [ ] Отображается статус скорого отсутствия (отпуск)
* [ ] На календаре отображаются переиоды отсутствия
* [ ] Возможность добавлять свои отсутствия (отпросился на день, на пол дня)
  * [ ] Возможность редактировать еще не начавшиеся
* [ ] Возможность перетаскивать столбцы как удобно
  
Итого нам нужно стораджи для:

* всех элементов (мастер)
  * задач
  * работ
  * тикетов
* пользователей
* интервалов
  * периодов

Загрузка выглядит так

* Загружаем временный лимиты (из кук)
* Создаем интервалы
* Каждый из них создает периоды
* Запрашиваем элементы за нужный период .foreEach
  * Конвертируем каждый из JSON структуры в один из подклассов DashItem (в конструкторе классов TaskItem/JobItem/...)
    * Каждый из них выбирает интервал
      * Период внутри интервала
  * Кладем созданный элемент в сторадж
  * Сравниваем его с имеющимися в стораджах элементами для поиска родни (предки, потомки)

Рендер выглядит в целом так:

* Рисуем интервалы (они вообще внешне не видны, но нужны для верстки персонального календаря, когда недели сверху вниз а дни слева направо)
  * каждый интервал выбирает свои периоды из стораджа и рисует их внутри себя
* каждый период рисует
  * свой title
  * свой data - выбирает всех пользователей
  * для каждого пользователя рисует ячейку (не все могут быть видимыми в данный момент)
    * в ячейку складывает все элементы на пересечении период+пользователь

### Сортировка внутри ячейки

* Сортируем все элементы по sort-index
  * Если sort-index совпадают - сортируем по временной отметке

### DashItem

* init - заполнить данными из Битрикс
* initNew - создать новый со значениями по умолчанию
* setInterval/unsetInterval - привязаться к инервалу (двусторонняя связь)/отвязаться
* setPeriod/unsetPeriod - привязаться к периоду (двусторонняя связь)/отвязаться
* findInterval/findPeriod - поиск подходящих интервала/периода с последующей привязкой
* update - изменение параметров на фронтенде (если указать save, то и бэкэнде)
* save - сохранение изменений в бэк
* movePosition - задать новые параметры элемента (после перемещения по сетке). Подтверждение изменений у пользователя. Принятие изменений в ГУЙ и в бэк

### Drag-n-Drop

* Элемент может упасть в ячейку или на другой элемент в ячейке
  * При падении на другой элемент
    * Определяем границу (мы кидаем над или под элемент)
    * Определяем sort-index'ы элемнтов между которыми уронили (для этого каждый элемент должен иметь доступ ко всему списку)
    * Ставим себе индекс по середине между соседями
  * При падении на ячейку добавляем элемент в конец списка (sort index больше самого большого)

таким образом

* в ячейке мы должны хранить признак, что это ячейка
  * макс. сортировку
  * пользователя
  * временную отметку
* в карточке мы должны хранить признак, что это карточка
  * пользователя
  * временную отметку
  * индекс карточки в списке
  * ссылку на весь список (для определения сортировок соседей)

### Редактирование

* Начало редактирования:
  * выставляем
    * isEdit=>true
    * editAttr=>title (или другой атрибут который редактируем (комментарий например))
* окончание редактирования
  * меняем отредактированное поле на значение из edit
  * сохраняем
  * перечитываем

### Родственные связи между элементами

Элемент может находиться в состоянии non-init (инициализация не завершена) и init
При изменении/загрузке данных в элемент он сам определяет какие у него childrenUids, parentsUids - это те элементы, на которые он ссылается сам (кто ссылается на него он не знает)
Если он уже проинициализирован, то вызывается поиск объектов на котоые у нас есть ссылки в UIDS массивах через мастер-хранилище
Если он еще не проинициализирован, то также ищутся и обратные ссылки на него (после инициализации повторно обратные ссылки не ищутся, т.к. UID самого себя никогда не меняется)

### Интеграция с Inventory

Q: Как мы обращаемся к Inventory
A: Через REST API

Q: Как мы авторизуемся в ней?
A: Наверно самое простое при старте дашборда запросить логин-пароль и проверять его через basic-auth

## Проблемы

* [x] Кажется бэкенд неправильно фильтрует задачи и подгружает их по дедлайну без учета просрочки. т.е. если дедлайн был 2 недели назад, а мы не подгружали этот период - задачу не увидим. - починено в версии xtest2
* [x] рендер ячейки проверяет значение переменной layout.dragOverCell; В случае изменения переменной - перерисовываются ВСЕ ячейки; надо сделать коллекцию параметров ячейки и изменять только нужную ячейку, а не одну переменную на всех - починено через setState конкретной ячейки
