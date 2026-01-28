import React, { useContext, useEffect, useState } from 'react';
import { observer } from 'mobx-react-lite';
import './invAuthForm.css';
import { StoreContext } from 'Data/Stores/StoreProvider';
import ConnectionStates from 'Components/Layout/ConnectionStates/ConnectionStates';
import { debugLogin, debugPassword, debugAutoLogin } from 'config.priv';
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
            if (debugAutoLogin) {
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

	const planningMode=()=> {
		this.context.layout.setPlansVisible(true);
		this.context.layout.setJobsVisible(false);
		this.context.layout.setExpand(false);
		this.context.layout.setAccomplicesVisible(false);
		this.context.layout.setTicketsVisible(false);
		this.context.layout.setTasksVisible(false);
		this.context.layout.setKeepPlanning(true);
	}
	const defaultMode=()=> {
		this.context.layout.setPlansVisible(true);
		this.context.layout.setJobsVisible(true);
		this.context.layout.setExpand(true);
		this.context.layout.setAccomplicesVisible(false);
		this.context.layout.setTicketsVisible(true);
		this.context.layout.setTasksVisible(true);
		this.context.layout.setKeepPlanning(false);
	}


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
			</div>

        </div>
    );
});

export default InvAuthForm;
