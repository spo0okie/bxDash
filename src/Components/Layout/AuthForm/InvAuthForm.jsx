import React, { useContext, useEffect, useState, useCallback } from 'react';
import { observer } from 'mobx-react-lite';
import './invAuthForm.css';
import { StoreContext } from 'Data/Stores/StoreProvider';
import ConnectionStates from 'Components/Layout/ConnectionStates/ConnectionStates';
import { debugLogin, debugPassword, debugAutoLogin, showTimeDebugUI } from 'config.priv';
import classNames from 'classnames';
import MenuButton from '../Header/Menu/MenuIButton';

const InvAuthForm = observer(function InvAuthForm() {
    const [login, setLogin] = useState('');
    const [password, setPassword] = useState('');
    const [status, setStatus] = useState('typing');
    const context = useContext(StoreContext);

    // Автозаполнение из конфигурации и автовход для отладки
    useEffect(() => {
        if (debugLogin && debugPassword) {
            setLogin(debugLogin);
            setPassword(debugPassword);
            
            // Если включен автовход - сразу выполняем авторизацию
            if (debugAutoLogin 
				&& context.main.bx.authStatus !== 'OK'
				&& context.main.zabbix.authStatus !== 'OK'
				&& context.main.inventory.authStatus !== 'OK'
			) {
                setStatus('submitting');
                context.main.authenticate(
                    debugLogin,
                    debugPassword,
                    () => setStatus('success'),
                    () => setStatus('error')
                );
            }
        }
    }, [context.main]);

    async function handleSubmit(e) {
        e.preventDefault();
        setStatus('submitting');
        context.main.authenticate(
            login,
            password,
            () => setStatus('success'),
            () => setStatus('error')
        );
    }

    function handleLoginChange(e) {
        setLogin(e.target.value);
    }

    function handlePasswordChange(e) {
        setPassword(e.target.value);
    }

	/** Переключение в режим планирования */
	const planningMode = useCallback(() => {
		context.layout.setPlansVisible(true);
		context.layout.setJobsVisible(false);
		context.layout.setAccomplicesVisible(false);
		context.layout.setTicketsVisible(false);
		context.layout.setTasksVisible(false);
		context.layout.setKeepPlanning(true);
	}, [context.layout]);

	/** Сброс настроек отображения к значениям по умолчанию */
	const defaultMode = useCallback(() => {
		context.layout.setPlansVisible(true);
		context.layout.setJobsVisible(true);
		context.layout.setAccomplicesVisible(false);
		context.layout.setTicketsVisible(true);
		context.layout.setTasksVisible(true);
		context.layout.setKeepPlanning(false);
	}, [context.layout]);

	/** Переключение на следующую неделю */
	const handleNextWeek = useCallback(() => {
		//переключаем на следующий понедельник
		const nextMonday = context.time.monday0 + 7 * 24 * 3600 * 1000;
		context.time.overrideDate(nextMonday);
	}, [context.time]);

	/** Переключение на предыдущую неделю */
	const handlePrevWeek = useCallback(() => {
		//переключаем на предыдущий понедельник
		const prevMonday = context.time.monday0 - 7 * 24 * 3600 * 1000;
		context.time.overrideDate(prevMonday);
	}, [context.time]);

	/** Переключение на следующий день */
	const handleNextDay = useCallback(() => {
		//переключаем на следующий день
		const nextDay = context.time.today + 24 * 3600 * 1000;
		context.time.overrideDate(nextDay);
	}, [context.time]);

	/** Переключение на предыдущий день */
	const handlePrevDay = useCallback(() => {
		//переключаем на предыдущий день
		const prevDay = context.time.today - 24 * 3600 * 1000;
		context.time.overrideDate(prevDay);
	}, [context.time]);

	/** Сброс переопределения даты */
	const handleResetTime = useCallback(() => {
		context.time.resetToRealTime();
	}, [context.time]);


    return (
		<div className={classNames(
			'invAuthForm', 
			{hasErrors: context.main.hasErrors,}
		)}>
			<div className='section'>
				<div className='menu'>
					<div className='options'>
						Опции:<br/>
						<MenuButton property='expand' title='дни' />
						<MenuButton property='expand' title='недели' classNames={['off', 'on']} />
						<br/>
						<MenuButton property='tasksVisible' title='задачи' />
						<MenuButton property='accomplicesVisible' title='помогаю' />
						<br/>
						<MenuButton property='jobsVisible' title='работы' />
						<br/>
						<MenuButton property='ticketsVisible' title='заявки' />
						<br/>
						<MenuButton property='plansVisible' title='планы' />
						<MenuButton property='keepPlanning' title='keepPlanning' />
					</div>
					<div className='presets'>
						Пресеты:<br/>
						<button onClick={planningMode} className="small">Режим планирования</button>
						<br/>
						<button onClick={defaultMode} className="small">Сброс</button>
					</div>
				</div>
			</div>
			<div className='section'>
				<h2>dash::Авторизация</h2>
				<form onSubmit={handleSubmit}>
					<input
						value={login}
						onChange={handleLoginChange}
						disabled={status === 'submitting'}
					/>
					<br />
					<input
						value={password}
						type="password"
						onChange={handlePasswordChange}
						disabled={status === 'submitting'}
					/>
					<br />
					<button
						disabled={
							login.length === 0 ||
							password.length === 0 ||
							status === 'submitting'
						}
					>
						Вход
					</button>
					{status === 'error' && (
						<p className="Error">Ошибка входа</p>
					)}
				</form>
			</div>
            <div className='section'>
				<ConnectionStates/>
				<p className='p-1'>Time: {context.time.strTime}</p>
				{context.time.isOverridden && (
					<p className='p-1 warning'>⚠️ Дата переопределена!</p>
				)}
			</div>
			{showTimeDebugUI && (
			<div className='section debug-section'>
				<div className='debug-time-controls'>
					<button className="small" onClick={handleNextWeek}>
						+1 неделя
					</button>
					<button className="small" onClick={handlePrevWeek}>
						-1 неделя
					</button>
					<button className="small" onClick={handleNextDay}>
						+1 день
					</button>
					<button className="small" onClick={handlePrevDay}>
						-1 день
					</button>
					<button
						className="small reset"
						onClick={handleResetTime}
						disabled={!context.time.isOverridden}
					>
						Сбросить
					</button>
				</div>
				<div className='debug-time-info'>
					<h3>Отладка времени</h3>
				
					<small>
						today: {context.time.today ? new Date(context.time.today).toLocaleDateString('ru-RU') : '—'}<br/>
						monday0: {context.time.monday0 ? new Date(context.time.monday0).toLocaleDateString('ru-RU') : '—'}<br/>
						overridden: {context.time.isOverridden ? 'да' : 'нет'}
					</small>
				</div>
			</div>
			)}

        </div>
    );
});

export default InvAuthForm;
