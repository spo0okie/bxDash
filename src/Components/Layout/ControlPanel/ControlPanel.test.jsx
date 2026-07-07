import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { StoreContext } from 'Data/Stores/StoreProvider';
import ControlPanel from './ControlPanel';

// Управляем отладочными кредами, не завися от window.__CONFIG__
jest.mock('config.priv', () => ({
  ...jest.requireActual('config.priv'),
  debugLogin: 'reviakin.a',
  debugPassword: 'test-password',
  debugAutoLogin: true,
  showTimeDebugUI: false,
}));

const makeConnection = () => ({
  availability: 'Pending',
  authStatus: 'Pending',
  userId: '-',
});

// Минимальный стор, покрывающий всё, что читают ControlPanel,
// MenuButton и ConnectionStates
const createMockStore = () => ({
  main: {
    bx: makeConnection(),
    zabbix: makeConnection(),
    inventory: makeConnection(),
    ast22: makeConnection(),
    hasErrors: false,
    authenticate: jest.fn(),
  },
  layout: {
    expand: false,
    tasksVisible: true,
    accomplicesVisible: false,
    jobsVisible: true,
    ticketsVisible: true,
    plansVisible: true,
    keepPlanning: false,
    useSplitBucket: false,
    incomingCallsVisible: false,
    outgoingCallsVisible: false,
    setPlansVisible: jest.fn(),
    setJobsVisible: jest.fn(),
    setAccomplicesVisible: jest.fn(),
    setTicketsVisible: jest.fn(),
    setTasksVisible: jest.fn(),
    setKeepPlanning: jest.fn(),
  },
  time: {
    tzMode: 'msk',
    setTzMode: jest.fn(),
    strTime: '12:00:00',
    tzLabel: 'МСК',
    isOverridden: false,
    today: 0,
    monday0: 0,
    overrideDate: jest.fn(),
    resetToRealTime: jest.fn(),
  },
  theme: {
    availableThemes: [],
    currentThemeId: null,
    setTheme: jest.fn(),
  },
  ws: null,
});

function renderWithStore(store = createMockStore()) {
  render(
    <StoreContext.Provider value={store}>
      <ControlPanel />
    </StoreContext.Provider>,
  );
  return store;
}

describe('ControlPanel', () => {
  test('рендерит форму авторизации', () => {
    renderWithStore();
    expect(screen.getByText('dash::Авторизация')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Вход' })).toBeInTheDocument();
  });

  test('заполняет форму данными из config.priv', async () => {
    renderWithStore();
    await waitFor(() => {
      expect(screen.getByDisplayValue('reviakin.a')).toBeInTheDocument();
    });
  });

  test('выполняет авторизацию при включенном автовходе', async () => {
    const store = renderWithStore();
    await waitFor(() => {
      expect(store.main.authenticate).toHaveBeenCalledWith(
        'reviakin.a',
        'test-password',
        expect.any(Function),
        expect.any(Function),
      );
    });
  });
});
