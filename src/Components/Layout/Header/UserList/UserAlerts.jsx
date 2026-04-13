import {get, keys} from 'mobx';
import { observer } from 'mobx-react';
import React, { useContext, useState, useEffect, useCallback} from 'react';
import { StoreContext } from 'Data/Stores/StoreProvider';
import TicketItem from 'Data/Models/TicketItem';
import './UserAlerts.css';
import { Tooltip } from 'antd';

/**
 * Компонент кнопки группы алертов с поддержкой hover-подсветки и фиксации тултипа
 * @param {number} severity - Уровень критичности (1-5)
 * @param {Array} list - Список алертов в группе
 * @param {string} username - Имя пользователя
 * @param {string} type - Тип алертов ('service' или 'support')
 */
const AlertListButton = observer(({severity, list, username, type}) => {
    const { alerts, main, layout, items, users } = useContext(StoreContext);
    const severityTitles = {1:'Информация',2:'Предупреждение',3:'Средняя',4:'Высокая',5:'Критическая'};
    
    // Получаем высоту окна из layout store для ограничения высоты тултипа
    const windowHeight = layout.windowDimensions.height || window.innerHeight;
    // Максимальная высота списка - 70% от высоты окна
    const maxListHeight = Math.round(windowHeight - 120);
    
    // Проверяем, является ли эта группа зафиксированной
    const pinnedGroup = alerts.pinnedAlertGroup;
    const isPinned = pinnedGroup !== null && 
                     pinnedGroup.username === username && 
                     pinnedGroup.type === type && 
                     pinnedGroup.severity === severity;
    
    // Эта группа активна, только если pinnedGroup null или это текущая зафиксированная группа
    const isActive = pinnedGroup === null || isPinned;
    
    // Локальное состояние видимости тултипа
    const [tooltipVisible, setTooltipVisible] = useState(false);
    
    // Сбрасываем видимость при изменении pinnedGroup для неактивных групп
    useEffect(() => {
        if (!isActive) {
            setTooltipVisible(false);
        } else if (isPinned) {
            // Если группа стала зафиксированной, показываем тултип
            setTooltipVisible(true);
        }
    }, [pinnedGroup, isActive, isPinned]);
    
    // Обработчики мыши
    const handleMouseEnter = useCallback(() => {
        if (isActive && !isPinned) {
            setTooltipVisible(true);
        }
    }, [isActive, isPinned]);
    
    const handleMouseLeave = useCallback(() => {
        if (isActive && !isPinned) {
            setTooltipVisible(false);
        }
    }, [isActive, isPinned]);
    
    // Обработчик клика для фиксации/разфиксации
    const handleClick = useCallback((e) => {
        e.stopPropagation();
        if (isPinned) {
            // Если уже зафиксирована - сбрасываем
            alerts.setPinnedAlertGroup(null);
            setTooltipVisible(false);
        } else {
            // Фиксируем эту группу
            alerts.setPinnedAlertGroup({ username, type, severity });
            setTooltipVisible(true);
        }
    }, [isPinned, alerts, username, type, severity]);
    
    /**
     * Обработчик закрытия pinned тултипа
     */
    const handlePinClose = useCallback((e) => {
        e.stopPropagation();
        alerts.setPinnedAlertGroup(null);
        setTooltipVisible(false);
    }, [alerts]);
    
    /**
     * Обработчик клика по ссылке алерта (предотвращает всплытие)
     */
    const handleAlertLinkClick = useCallback((e) => {
        e.stopPropagation();
    }, []);
    
    /**
     * Создает заявку из алерта
     * @param {Object} alert - объект алерта
     */
    const createTicketFromAlert = useCallback((alert) => {
        // Найти пользователя по username (полное имя, login или ID) в users.items
        const usersItems = users.items;
        let userId = null;
        
        // Сначала пробуем найти по login, затем по name, затем как ID
        const usernameNum = Number(username);
        
        usersItems.forEach((user, id) => {
            if (userId) return; // уже нашли
            if (user.login === username || user.name === username || id === usernameNum) {
                userId = id;
            }
        });
        
        // Если не нашли, пробуем найти по частичному совпадению в name
        if (!userId) {
            usersItems.forEach((user, id) => {
                if (userId) return;
                if (user.name && user.name.includes(username)) {
                    userId = id;
                }
            });
        }
        
        if (!userId) {
            console.error('User not found for username:', username);
            return;
        }
        
        // Получить данные алерта
        const triggerid = get(alert, 'objectid');
        const eventid = get(alert, 'eventid');
        const host = get(alert, 'host');
        const name = get(alert, 'name');
        
        // Создать URL для ссылки на Zabbix
        const href = main.zabbix.baseUrl + "tr_events.php?triggerid=" + triggerid + "&eventid=" + eventid;
        
        // Получить items для ticket
        const ticketItems = items['ticket'];
        
        // Создать новый TicketItem
        const item = new TicketItem({
            id: ticketItems.getMaxId() + 64,
            title: host + ': ' + name + '\n' + href,
            user: userId,                    // пользователь на ком висит алерт
            owner: main.bx.userId,          // авторизованный пользователь
            isNew: true,
            isEdit: true,
        }, {}, ticketItems);
        
        // Добавить в store
        ticketItems.setItem(item);
        
        // Открыть модальное окно создания заявки
        layout.setTicketModalVisible(true);
    }, [main, username, layout, items, users]);
    
    /**
     * Обработчик клика по кнопке создания заявки из алерта
     * @param {Object} alert - объект алерта
     */
    const handleCreateTicketClick = useCallback((e, alert) => {
        e.stopPropagation();
        createTicketFromAlert(alert);
    }, [createTicketFromAlert]);
    
    // Формируем контент тултипа с кнопкой закрытия
    const tooltipContent = (
        <div className={`tooltip-content ${isPinned ? 'pinned' : ''}`}>
            <h4 className='user-alerts'>
                {severityTitles[severity]}
                {isPinned && (
                    <button 
                        className='pin-close' 
                        onClick={handlePinClose}
                        title="Закрыть"
                    >
                        ✕
                    </button>
                )}
            </h4>
            <div 
                className="tooltip-alerts-list"
                style={{ maxHeight: maxListHeight }}
            >
                <ul className="user-alerts">
                    {list.map((item, index) => {
                        const triggerid = get(item, 'objectid');
                        const eventid = get(item, 'eventid');
                        const host = get(item, 'host');
                        const name = get(item, 'name');
                        const keyId = `${severity}-${eventid || triggerid || name || index}`;
                        
                        return (
                            <li key={keyId} className="alert-item">
                                <a 
                                    href={main.zabbix.baseUrl + "tr_events.php?triggerid=" + triggerid + "&eventid=" + eventid}
                                    target='_blank' 
                                    rel="noreferrer"
                                    onClick={handleAlertLinkClick}
                                >
                                    {host}: {name}
                                </a>
                                <button 
                                    className="create-ticket-from-alert"
                                    onClick={(e) => handleCreateTicketClick(e, item)}
                                    title="Сформировать заявку"
                                >
                                    🎫
                                </button>
                            </li>
                        );
                    })}
                </ul>
            </div>
        </div>
    );
    
    if (list.length === 0) {
        return null;
    }
    
    // Если есть зафиксированная группа и это не она, тултип не показываем вообще
    const showTooltip = isActive && (isPinned || !pinnedGroup);
    
    return (
        <Tooltip
            title={tooltipContent}
            open={showTooltip ? tooltipVisible : false}
            overlayInnerStyle={{maxWidth: '500px'}}
            getPopupContainer={(triggerNode) => triggerNode.parentElement}
            mouseEnterDelay={0.1}
            mouseLeaveDelay={0.1}
            zIndex={isPinned ? 2000 : 1000}
        >
            <span 
                className={`severity${severity} item ${isActive ? 'active' : 'inactive'} ${isPinned ? 'pinned' : ''}`}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
                onClick={handleClick}
            >
                {list.length}
            </span>
        </Tooltip>
    );
});


/**
 * Компонент отображения алертов пользователя
 * Группирует алерты по критичности и типу (service/support)
 */
const UserAlerts = observer((props) => {
    const { alerts } = useContext(StoreContext);
    const { username } = props;
    
    const serviceAlerts = get(alerts.service, username);
    const supportAlerts = get(alerts.support, username);

    const priorityLabels = [1, 2, 3, 4, 5];

    let serviceCounts = [];
    let supportCounts = [];
    
    priorityLabels.forEach((priority) => {
        let service=0;
        let support=0;
        let serviceList=[];
        let supportList=[];
        
        if (serviceAlerts) keys(serviceAlerts).forEach(key => {
            const alert=get(serviceAlerts,key);
            if (Number(get(alert,'severity'))===priority) {
                service++;
                serviceList.push(alert);
            }
        });	
        
        if (supportAlerts) keys(supportAlerts).forEach(key => {
            const alert=get(supportAlerts,key);
            if (Number(get(alert,'severity'))===priority) {
                support++;
                supportList.push(alert);
            }
        });	
        
        serviceCounts.push({priority, count: service, list: serviceList});
        supportCounts.push({priority, count: support, list: supportList});
    });

    return (<>
        <div className="user-alerts service">
            {serviceCounts.map(({ priority, list }) => (
                <AlertListButton 
                    key={priority} 
                    list={list} 
                    severity={priority}
                    username={username}
                    type="service"
                />
            ))}
        </div>
        <div className="user-alerts support">
            {supportCounts.map(({ priority, list }) => (
                <AlertListButton 
                    key={priority} 
                    list={list} 
                    severity={priority}
                    username={username}
                    type="support"
                />
            ))}
        </div>
    </>);
});

export default UserAlerts;
