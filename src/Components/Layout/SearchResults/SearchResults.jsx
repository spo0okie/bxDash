import React, { useContext } from "react";
import { observer } from "mobx-react";
import { get } from "mobx";
import { Button, Spin } from "antd";
import { StoreContext } from "Data/Stores/StoreProvider";
import TaskCard from "Components/Items/ItemCards/Task/TaskCard";
import "./SearchResults.css";

/**
 * Компонент для отображения результатов поиска задач
 * Показывает список найденных задач с возможностью закрытия режима поиска
 */
const SearchResults = observer(() => {
	const context = useContext(StoreContext);
	const { items } = context;
	const taskStore = items.task;

	// Если режим поиска не активен - не рендерим компонент
	if (!taskStore.searchMode) {
		return null;
	}

	// Обработчик клика по задаче - закрывает режим поиска
	const handleTaskClick = (taskId) => {
		taskStore.clearSearch();
		// Дополнительно: можно добавить прокрутку к задаче или навигацию
	};

	// Обработчик закрытия результатов поиска
	const handleClose = () => {
		taskStore.clearSearch();
	};

	// Состояние загрузки
	if (taskStore.isSearching) {
		return (
			<div className="search-results">
				<div className="search-results-header">
					<h3>Поиск задач</h3>
					<Button onClick={handleClose}>Закрыть</Button>
				</div>
				<div className="search-results-loading">
					<Spin size="large" />
					<span>Поиск задач...</span>
				</div>
			</div>
		);
	}

	// Проверка минимальной длины запроса
	if (!taskStore.searchQuery || taskStore.searchQuery.length < 3) {
		return (
			<div className="search-results">
				<div className="search-results-header">
					<h3>Результаты поиска</h3>
					<Button onClick={handleClose}>Закрыть</Button>
				</div>
				<div className="search-results-empty">
					<span>Введите минимум 3 символа</span>
				</div>
			</div>
		);
	}

	// Получаем количество результатов
	const resultsCount = taskStore.searchResults.length;

	// Если результатов нет
	if (resultsCount === 0) {
		return (
			<div className="search-results">
				<div className="search-results-header">
					<h3>Результаты поиска: 0 задач</h3>
					<Button onClick={handleClose}>Закрыть</Button>
				</div>
				<div className="search-results-empty">
					<span>Ничего не найдено</span>
					<p>Попробуйте изменить поисковый запрос</p>
				</div>
			</div>
		);
	}

	// Создаём dummy cell для TaskCard (в режиме поиска используем null)
	// TaskCard требует cell для проверки visibility и dnd логики
	const dummyCell = null;

	return (
		<div className="search-results">
			<div className="search-results-header">
				<h3>Результаты поиска: {resultsCount} задач</h3>
				<Button type="primary" onClick={handleClose}>
					Закрыть результаты
				</Button>
			</div>
			<div className="search-results-list">
				{taskStore.searchResults.map((taskId, index) => {
					const task = get(taskStore.items, taskId);
					if (!task) {
						return null;
					}
					return (
						<div
							key={taskId}
							className="search-result-item"
							onClick={() => handleTaskClick(taskId)}
							role="button"
							tabIndex={0}
							onKeyDown={(e) => {
								if (e.key === "Enter" || e.key === " ") {
									handleTaskClick(taskId);
								}
							}}
						>
							<TaskCard
								task={{ id: taskId }}
								cell={dummyCell}
								index={index}
							/>
						</div>
					);
				})}
			</div>
		</div>
	);
});

export default SearchResults;
