import React, { useState, useEffect } from "react";
import { observer } from "mobx-react-lite";
import { ConfigProvider } from "antd";

import './App.css';
import Layout from "Components/Layout/Layout";
import { loadBitrixLibraries } from 'Helpers/BitrixLibraries';
import notify from 'Helpers/Notify';
import { StoreContext, createStores } from "Data/Stores/StoreProvider";


/** Корневой компонент приложения и инициализация интеграций. */
function App() {
    // Стораджи создаются ровно один раз — useState с ленивым инициализатором
    // идемпотентен даже при двойном mount от React.StrictMode
    const [stores] = useState(() => createStores());

    useEffect(() => {
        // Общий Promise исключает повторное подключение в StrictMode.
        loadBitrixLibraries().catch(error => {
            notify.error(error.message, { title: 'Не удалось подключить Bitrix' });
        });
    }, []);

    // Доступ из консоли только в dev-сборке
    useEffect(() => {
        if (!import.meta.env.DEV) return;
        Object.assign(window, {
            mainStore: stores.main,
            timeStore: stores.time,
            usersStore: stores.users,
            layoutStore: stores.layout,
            periodsStore: stores.periods,
            itemsStore: stores.items,
            alertsStore: stores.alerts,
            themeStore: stores.theme,
        });
        console.log('Stores exported to window: timeStore, layoutStore, periodsStore, mainStore, usersStore, itemsStore, alertsStore, themeStore');
    }, [stores]);

    return (
        <StoreContext.Provider value={stores}>
            <ThemedRoot />
        </StoreContext.Provider>
    );
}

/**
 * AntD ConfigProvider, подписанный на ThemeStore. Вынесен внутрь Provider'а,
 * чтобы read из stores происходил под StoreContext, и вынесен в observer,
 * чтобы перерисовываться при смене темы.
 */
const ThemedRoot = observer(() => {
    const { theme } = React.useContext(StoreContext);
    return (
        <ConfigProvider theme={theme.antdTheme}>
            <Layout />
        </ConfigProvider>
    );
});

export default App;
