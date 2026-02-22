import React, { useState, useCallback } from "react";
import './EditItem.css';
// TODO: https://www.npmjs.com/package/react-textarea-autosize
import { Input } from 'antd';

const { TextArea } = Input;

/**
 * Компонент редактирования элемента
 * Предоставляет textarea для редактирования названия элемента с обработкой клавиш
 * @param {Object} props - Свойства компонента
 * @param {Object} props.item - Редактируемый элемент с методами onCompleteEdit, onCancelEdit, onLostFocus
 */
const EditItem = ({ item }) => {
	// Локальное состояние для значения текстового поля
	const [value, setValue] = useState(item.editValue ?? '');

	/**
	 * Обработчик нажатия клавиш
	 * Escape - отмена редактирования
	 * Enter (без модификаторов) - завершение редактирования
	 * Enter (с Ctrl/Alt/Shift) - вставка новой строки
	 */
	const handleKeydown = useCallback((event) => {
		const input = event.target;

		if (event.code === 'Escape') {
			if (item.onCancelEdit !== undefined) item.onCancelEdit();
			event.preventDefault();
			return false;
		}

		if (event.code === 'Enter') {
			if (event.altKey || event.ctrlKey || event.shiftKey) {
				insertNewLine(input);
				dispatchInput(input);
				event.preventDefault();
				return false;
			}

			if (item.onCompleteEdit !== undefined) item.onCompleteEdit();
			event.preventDefault();
			return false;
		}
	}, [item]);

	/**
	 * Обработчик потери фокуса
	 */
	const handleLostFocus = useCallback((event) => {
		console.log('1');
		if (item.onLostFocus !== undefined) item.onLostFocus();
		event.stopPropagation();
	}, [item]);

	/**
	 * Обработчик изменения значения
	 */
	const handleChange = useCallback((event) => {
		const newValue = event.target.value;
		setValue(newValue);
		item.editValue = newValue;
	}, [item]);

	/**
	 * Вставляет новую строку в позицию курсора
	 * @param {HTMLInputElement|HTMLTextAreaElement} input - Элемент ввода
	 */
	const insertNewLine = (input) => {
		const cursorPos = input.selectionStart ?? input.value.length;
		const selectionEnd = input.selectionEnd ?? cursorPos;
		const currentValue = input.value;
		const newline = "\r\n";
		input.value = currentValue.substring(0, cursorPos) + newline + currentValue.substring(selectionEnd);
		const newPos = cursorPos + 1;
		input.selectionStart = newPos;
		input.selectionEnd = newPos;
	};

	/**
	 * Отправляет событие input для обновления значения
	 * @param {HTMLInputElement|HTMLTextAreaElement} input - Элемент ввода
	 */
	const dispatchInput = (input) => {
		input.dispatchEvent(new Event('input', { bubbles: true }));
	};

	return (
		<TextArea
			className="EditItem"
			onKeyDown={handleKeydown}
			onChange={handleChange}
			onBlur={handleLostFocus}
			value={value}
			autoFocus
			autoSize={{ minRows: Math.max(2, item.title.split("\n").length) }}
		/>
	);
};

export default EditItem;
