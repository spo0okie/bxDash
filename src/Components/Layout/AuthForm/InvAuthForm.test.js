import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import InvAuthForm from '../src/Components/Layout/AuthForm/InvAuthForm';

// Mock для MobX store
const mockStore = {
  main: {
    authenticate: jest.fn()
  }
};

// Mock для useContext
jest.mock('react', () => ({
  ...jest.requireActual('react'),
  useContext: () => mockStore
}));

describe('InvAuthForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('рендерит форму авторизации', () => {
    render(<InvAuthForm />);
    expect(screen.getByText('Авторизация')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Вход/i })).toBeInTheDocument();
  });

  test('заполняет форму данными из config.priv.js', async () => {
    render(<InvAuthForm />);
    
    // Проверяем автозаполнение
    await waitFor(() => {
      expect(screen.getByDisplayValue('reviakin.a')).toBeInTheDocument();
    });
  });

  test('выполняет авторизацию при включенном автовходе', async () => {
    render(<InvAuthForm />);
    
    // Ждем автозаполнения
    await waitFor(() => {
      expect(screen.getByDisplayValue('reviakin.a')).toBeInTheDocument();
    });
    
    // Проверяем что authenticate был вызван
    expect(mockStore.main.authenticate).toHaveBeenCalled();
  });
});