import { useContext, useState } from 'react';
import { observer } from 'mobx-react-lite';
import './invAuthForm.css';
import { StoreContext } from 'Data/Stores/StoreProvider';
import ConnectionStates from 'Components/Layout/ConnectionStates/ConnectionStates';

const InvAuthForm = observer(function InvAuthForm() {
    const [login, setLogin] = useState('');
    const [password, setPassword] = useState('');
    const [status, setStatus] = useState('typing');
    const context = useContext(StoreContext);

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

    return (
        <div className="invAuthForm">
			<div className='section'>
				<h1>dash</h1>
			</div>
			<div className='section'>
				<h2>Авторизация</h2>
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
			</div>

        </div>
    );
});

export default InvAuthForm;