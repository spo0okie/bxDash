import React, { useState, useContext, useEffect } from "react";
import { observer } from "mobx-react";
import { StoreContext } from "Data/Stores/StoreProvider";
import { Modal, Input, Select, message } from 'antd';

// Текстовое поле для ввода
const { TextArea } = Input;

/**
 * Модальное окно создания заявки (тикета) в битриксе
 * Использует стандартный жизненный цикл DashItem через ticketItem.save()
 * Позволяет выбрать автора (owner) и исполнителя (responsible) заявки
 */
const CreateTicketModal = observer((props) => {
    const context = useContext(StoreContext);
    const visible = context.layout.ticketModalVisible;
    
    // Состояние формы
    const [text, setText] = useState('');
    const [owner, setOwner] = useState(null);           // Автор заявки (из bxUsersList)
    const [responsible, setResponsible] = useState(null); // Исполнитель (из users дашборда)
    const [loading, setLoading] = useState(false);
    const [usersLoading, setUsersLoading] = useState(false);
    
    // Найти текущий редактируемый тикет (isNew + isEdit)
    const ticketItem = Array.from(context.items['ticket'].items.values())
        .find(item => item.isNew && item.isEdit);

	const onClose = () => {
		setLoading(false);
		context.layout.setTicketModalVisible(false);
		ticketItem?.delete();
	}
    
    // При открытии модального окна загружаем список пользователей и инициализируем значения
    useEffect(() => {
        if (visible) {
            setUsersLoading(true);
            context.main.fetchBxUsersList()
                .finally(() => {
                    setUsersLoading(false);
                });
            
            // Устанавливаем текущего пользователя как автора по умолчанию
            if (context.main.bx.userId && !owner) {
                setOwner(context.main.bx.userId);
            }
            
            // Инициализируем исполнителя из ticketItem.user (пользователь секции)
            if (ticketItem && ticketItem.user && !responsible) {
                setResponsible(ticketItem.user);
            }
            
            // Инициализируем текст если тикет только что создан
            if (ticketItem && !text) {
                ticketItem.editValue = ticketItem.title + 
                    (ticketItem.message ? '\n' + ticketItem.message : '');
                setText(ticketItem.editValue);
            }
        }
    }, [visible]);
    
    // При изменении ticketItem обновляем owner и responsible
    useEffect(() => {
        if (ticketItem) {
            // Обновляем автора если задан
            if (ticketItem.owner) {
                setOwner(ticketItem.owner);
            }
            // Обновляем исполнителя из пользователя секции
            if (ticketItem.user && !responsible) {
                setResponsible(ticketItem.user);
            }
        }
    }, [ticketItem]);
    
    // Очистка формы при закрытии
    useEffect(() => {
        if (!visible) {
            setText('');
            setOwner(null);
            setResponsible(null);
        }
    }, [visible]);
    
    /**
     * Обработка создания заявки через стандартный save()
     */
    const handleSubmit = async () => {
        // Валидация
        if (!text.trim()) {
            message.error('Введите текст заявки');
            return;
        }
        if (!owner) {
            message.error('Выберите автора заявки');
            return;
        }
        if (!responsible) {
            message.error('Выберите исполнителя заявки');
            return;
        }
        if (!ticketItem) {
            message.error('Тикет не найден');
            return;
        }
        
        const lines = text.split('\n');
        if (lines.length === 0 || !lines[0].trim()) {
            message.error('Первая строка должна содержать заголовок заявки');
            return;
        }
        
        setLoading(true);
        
        try {
            // Обновляем данные тикета
            ticketItem.title = lines[0];
            ticketItem.message = lines.length > 1 ? lines.slice(1).join('\n') : '';
            ticketItem.owner = owner;
            ticketItem.user = responsible;  // Устанавливаем выбранного исполнителя
            
            // Вызываем стандартный save() из DashItem
            ticketItem.save({}, 
                () => {
                    message.success('Заявка создана успешно');
                	onClose();
                },
                (error) => {
                    message.error(error?.message || 'Ошибка при создании заявки');
                    setLoading(false);
                }
            );
        } catch (error) {
            console.error('Error creating ticket:', error);
            message.error(error.message || 'Ошибка при создании заявки');
            setLoading(false);
        }
    };
    
    // Получаем имя выбранного исполнителя для отображения в заголовке
    const responsibleUserName = responsible 
        ? (context.users.items.get(responsible)?.name || `Пользователь ${responsible}`)
        : '';
    
    // Формируем заголовок с именем ответственного
    const modalTitle = responsibleUserName 
        ? `Новая заявка для ${responsibleUserName}`
        : 'Новая заявка';
    
    return (
        <Modal
            title={modalTitle}
            open={visible}
            onCancel={()=>{
				context.layout.setTicketModalVisible(false);
				ticketItem?.delete();
			}}
            onOk={handleSubmit}
            confirmLoading={loading}
            okText="Создать"
            cancelText="Отмена"
            width={600}
        >
            {/* Выбор автора заявки */}
            <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>
                    Автор заявки *
                </label>
                <Select
                    value={owner}
                    onChange={setOwner}
                    loading={usersLoading}
                    showSearch
                    optionFilterProp="label"
                    filterOption={(input, option) => {
                        const label = option.label;
                        return typeof label === 'string' && label.toLowerCase().includes(input.toLowerCase());
                    }}
                    style={{ width: '100%' }}
                    placeholder="Выберите автора"
                    notFoundContent={usersLoading ? 'Загрузка...' : 'Пользователи не найдены'}
                >
                    {context.main.bxUsersList.map(user => (
                        <Select.Option 
                            key={user.id} 
                            value={user.id}
                            label={`${user.name} (${user.login})`}
                        >
                            {user.name} ({user.login})
                        </Select.Option>
                    ))}
                </Select>
            </div>
            
            {/* Выбор исполнителя (ответственного) - из сотрудников дашборда */}
            <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>
                    Исполнитель (ответственный) *
                </label>
                <Select
                    value={responsible}
                    onChange={setResponsible}
                    showSearch
                    optionFilterProp="label"
                    filterOption={(input, option) => {
                        const label = option.label;
                        return typeof label === 'string' && label.toLowerCase().includes(input.toLowerCase());
                    }}
                    style={{ width: '100%' }}
                    placeholder="Выберите исполнителя"
                >
                    {context.users.order.map(userId => {
                        const user = context.users.items.get(userId);
                        return (
                            <Select.Option 
                                key={userId} 
                                value={userId}
                                label={user?.name || `Пользователь ${userId}`}
                            >
                                {user?.name || `Пользователь ${userId}`}
                            </Select.Option>
                        );
                    })}
                </Select>
            </div>
            
            {/* Текстовое поле для ввода */}
            <div>
                <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>
                    Текст заявки *
                </label>
                <div style={{ marginBottom: 8, color: '#666', fontSize: 12 }}>
                    Первая строка - заголовок заявки, остальные строки - сообщение
                </div>
                <TextArea
                    value={text}
                    onChange={e => setText(e.target.value)}
                    placeholder="Введите текст заявки..."
                    rows={8}
                    autoFocus
                />
            </div>
        </Modal>
    );
});

export default CreateTicketModal;
