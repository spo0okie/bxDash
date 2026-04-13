import React, { useContext, useState, useCallback, useRef, useEffect } from "react";
import { Input, Button, Spin } from "antd";
import { SearchOutlined, CloseCircleOutlined, SearchOutlined as SearchIcon } from "@ant-design/icons";
import { observer } from "mobx-react-lite";
import { get } from "mobx";
import { StoreContext } from "Data/Stores/StoreProvider";
import TaskCard from "Components/Items/ItemCards/Task/TaskCard";
import "./TaskSearch.css";

const DEBOUNCE_DELAY = 400;
const MIN_SEARCH_LENGTH = 3;

const TaskSearch = observer(() => {
	const context = useContext(StoreContext);
	const { items } = context;
	const taskStore = items.task;

	const [inputValue, setInputValue] = useState("");
	const debounceTimerRef = useRef(null);

	const handleInputChange = useCallback((e) => {
		const value = e.target.value;
		setInputValue(value);

		if (value.length === 0) {
			taskStore.clearSearch();
			return;
		}
	}, [taskStore]);

	const handleSearchClick = useCallback(() => {
		if (inputValue.length >= MIN_SEARCH_LENGTH) {
			taskStore.setSearchQuery(inputValue);
			taskStore.searchTasks(inputValue);
		}
	}, [inputValue, taskStore]);

	const handleClear = useCallback(() => {
		if (debounceTimerRef.current) {
			clearTimeout(debounceTimerRef.current);
		}
		setInputValue("");
		taskStore.clearSearch();
	}, [taskStore]);

	const handleTaskClick = useCallback(() => {
		taskStore.clearSearch();
		setInputValue("");
	}, [taskStore]);

	useEffect(() => {
		return () => {
			if (debounceTimerRef.current) {
				clearTimeout(debounceTimerRef.current);
			}
		};
	}, []);

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

	if (!taskStore.searchMode) {
		return null;
	}

	const showValidationHint = inputValue.length > 0 && inputValue.length < MIN_SEARCH_LENGTH;
	const resultsCount = taskStore.searchResults.length;
	const hasQuery = taskStore.searchQuery && taskStore.searchQuery.length >= MIN_SEARCH_LENGTH;

	const renderResults = () => {
		if (taskStore.isSearching) {
			return (
				<div className="task-search-results-state">
					<Spin size="large" />
					<span>Поиск задач...</span>
				</div>
			);
		}

		if (showValidationHint || !hasQuery) {
			return (
				<div className="task-search-results-state">
					<span>Введите минимум {MIN_SEARCH_LENGTH} символа</span>
				</div>
			);
		}

		if (resultsCount === 0) {
			return (
				<div className="task-search-results-state">
					<span>Ничего не найдено</span>
				</div>
			);
		}

		return (
			<div className="task-search-results-list">
				{taskStore.searchResults.map((taskId, index) => {
					const task = get(taskStore.items, taskId);
					if (!task) return null;

					return (
						<div
							key={taskId}
							className="task-search-result-item"
							onClick={handleTaskClick}
							role="button"
							tabIndex={0}
							onKeyDown={(e) => {
								if (e.key === "Enter" || e.key === " ") {
									handleTaskClick();
								}
							}}
						>
							<TaskCard
								task={{ id: taskId }}
								cell={null}
								index={index}
							/>
						</div>
					);
				})}
			</div>
		);
	};

	return (
		<div className="task-search-modal">
			<div className="task-search-header">
				<div className="task-search-title">Поиск задач</div>
				{hasQuery && (
					<div className="task-search-count">{resultsCount} задач</div>
				)}
			</div>

			<div className="task-search-wrapper">
				<Input
					value={inputValue}
					onChange={handleInputChange}
					onPressEnter={handleSearchClick}
					placeholder="Поиск задач..."
					prefix={<SearchIcon className="task-search-icon" />}
					suffix={getSuffix()}
					className="task-search-input"
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

			{renderResults()}
		</div>
	);
});

export default TaskSearch;
