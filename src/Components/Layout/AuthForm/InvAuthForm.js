import { useContext, useState } from 'react';
import './invAuthForm.css';
import { StoreContext } from 'Data/Stores/StoreProvider';

export default function InvAuthForm() {
    const [login, setLogin] = useState('');
    const [password, setPassword] = useState('');
    const [status, setStatus] = useState('typing');
	const context=useContext(StoreContext);

    async function handleSubmit(e) {
        e.preventDefault();
        setStatus('submitting');
        context.main.authenticateBx(
            login,
            password,
            ()=>setStatus('success'),
            ()=>setStatus('error')
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
                    type='password'
                    onChange={handlePasswordChange}
                    disabled={status === 'submitting'}
                />
                <br />
                <button disabled={
                    login.length === 0 ||
                    password.length === 0 ||
                    status === 'submitting'
                }>
                    Вход
                </button>
                {status === 'error' &&
                    <p className="Error">
                        Ошибка входа
                    </p>
                }
        </form>
        </div>
    );
}
