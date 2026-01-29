// Утилиты для работы с сохраненными учетными данными
const STORAGE_KEYS = {
  LOGIN: 'bxDash_savedLogin',
  PASSWORD: 'bxDash_savedPassword',
  AUTO_LOGIN: 'bxDash_autoLogin'
};

class AuthStorage {
  // Сохранение учетных данных
  static saveCredentials(login, password) {
    if (login && password) {
      localStorage.setItem(STORAGE_KEYS.LOGIN, login);
      localStorage.setItem(STORAGE_KEYS.PASSWORD, password);
      localStorage.setItem(STORAGE_KEYS.AUTO_LOGIN, 'true');
    }
  }

  // Получение сохраненных учетных данных
  static getSavedCredentials() {
    return {
      login: localStorage.getItem(STORAGE_KEYS.LOGIN),
      password: localStorage.getItem(STORAGE_KEYS.PASSWORD),
      autoLogin: localStorage.getItem(STORAGE_KEYS.AUTO_LOGIN) === 'true'
    };
  }

  // Очистка сохраненных данных
  static clearSavedCredentials() {
    localStorage.removeItem(STORAGE_KEYS.LOGIN);
    localStorage.removeItem(STORAGE_KEYS.PASSWORD);
    localStorage.removeItem(STORAGE_KEYS.AUTO_LOGIN);
  }

  // Проверка наличия сохраненных данных
  static hasSavedCredentials() {
    const { login, password } = this.getSavedCredentials();
    return !!(login && password);
  }
}

export default AuthStorage;