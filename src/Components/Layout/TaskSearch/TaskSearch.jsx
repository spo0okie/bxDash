import React, { useContext, useState, useCallback, useRef, useEffect } from "react";
import { Input, Button, Spin, Badge } from "antd";
import { SearchOutlined, CloseCircleOutlined, SearchOutlined as SearchIcon } from "@ant-design/icons";
import { observer } from "mobx-react-lite";
import { StoreContext } from "Data/Stores/StoreProvider";
import "./TaskSearch.css";

const DEBOUNCE_DELAY = 400;
const MIN_SEARCH_LENGTH = 3;

const TaskSearch = observer(() => {
	const context = useContext(StoreContext);
	const { items } = context;
	const taskStore = items.task;

	const [inputValue, setInputValue] = useState("");
	const debounceTimerRef = useRef(null);

	/**
	 * Обработчик изменения значения в поле ввода
	 * Сбрасывает таймер debounce для отложенного поиска
	 */
	const handleInputChange = useCallback((e) => {
		const value = e.target.value;
		setInputValue(value);

		if (debounceTimerRef.current) {
			clearTimeout(debounceTimerRef.current);
		}

		if (value.length === 0) {
			taskStore.clearSearch();
			return;
		}

		if (value.length >= MIN_SEARCH_LENGTH) {
			debounceTimerRef.current = setTimeout(() => {
				taskStore.setSearchQuery(value);
				taskStore.searchTasks(value);
			}, DEBOUNCE_DELAY);
		}
	}, [taskStore]);

	/**
	 * Обработчик кнопки немедленного поиска
	 * Выполняет поиск сразу при клике на лупу
	 */
	const handleSearchClick = useCallback(() => {
		if (debounceTimerRef.current) {
			clearTimeout(debounceTimerRef.current);
		}

		if (inputValue.length >= MIN_SEARCH_LENGTH) {
			taskStore.setSearchQuery(inputValue);
			taskStore.searchTasks(inputValue);
		}
	}, [inputValue, taskStore]);

	/**
	 * Обработчик кнопки очистки
	 * Сбрасывает поле ввода и параметры поиска
	 */
	const handleClear = useCallback(() => {
		if (debounceTimerRef.current) {
			clearTimeout(debounceTimerRef.current);
		}
		setInputValue("");
		taskStore.clearSearch();
	}, [taskStore]);

	/**
	 * Очистка таймера при размонтировании компонента
	 */
	useEffect(() => {
		return () => {
			if (debounceTimerRef.current) {
				clearTimeout(debounceTimerRef.current);
			}
		};
	}, []);

	/**
	 * Формирование содержимого суффикса поля ввода
	 * Показывает спиннер при загрузке или кнопку очистки
	 */
	const getSuffix = () => {
		if (taskStore.isSearching) {
			return <Spin size="small" />;
		}
		if (inputValue.length > 0) {
			return (
				<Button
					type="text"
					size="small"
					icon={<CloseCircleOutlined />}
					onClick={handleClear}
					className="task-search-clear-btn"
					aria-label="Очистить поиск"
				/>
			);
		}
		return null;
	};

	/**
	 * Проверка валидности запроса для отображения подсказки
	 */
	const showValidationHint = inputValue.length > 0 && inputValue.length < MIN_SEARCH_LENGTH;

	return (
		<div className="task-search">
			<div className="task-search-wrapper">
				<Input
					value={inputValue}
					onChange={handleInputChange}
					onPressEnter={handleSearchClick}
					placeholder="Поиск задач..."
					prefix={<SearchIcon className="task-search-icon" />}
					suffix={getSuffix()}
					className="task-search-input"
					disabled={taskStore.isSearching}
					allowClear={false}
					maxLength={100}
				/>
				<Button
					type="primary"
					icon={<SearchOutlined />}
					onClick={handleSearchClick}
					className="task-search-btn"
					disabled={inputValue.length < MIN_SEARCH_LENGTH || taskStore.isSearching}
					aria-label="Искать"
				/>
			</div>

			{showValidationHint && (
				<div className="task-search-hint">
					Введите минимум {MIN_SEARCH_LENGTH} символа
				</div>
			)}

			{taskStore.searchMode && (
				<div className="task-search-results">
					<Badge
						count={taskStore.searchResults.length}
						showZero
						color="#52c41a"
						text={
							<span className="task-search-badge-text">
								{taskStore.searchResults.length === 0
									? "ничего не найдено"
									: `найден${getFoundWordEnding(taskStore.searchResults.length)}`}
							</span>
						}
					/>
				</div>
			)}
		</div>
	);
});

/**
 * Возвращает правильное окончание слова "найден" в зависимости от числа
 * @param {number} count - Количество найденных элементов
 * @returns {string} Окончание слова
 */
function getFoundWordEnding(count) {
	const lastDigit = count % 10;
	const lastTwoDigits = count % 100;

	if (lastTwoDigits >= 11 && lastTwoDigits <= 14) {
		return "о";
	}
	if (lastDigit === 1) {
		return "";
	}
	if (lastDigit >= 2 && lastDigit <= 4) {
		return "о";
	}
	return "о";
}

export default TaskSearch;
