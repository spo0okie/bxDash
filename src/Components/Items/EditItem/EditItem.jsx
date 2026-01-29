
import React from "react";
import './EditItem.css';
//TODO https://www.npmjs.com/package/react-textarea-autosize
import { Input } from 'antd';

const { TextArea } = Input;

export default class EditItem extends React.Component {

	constructor(props) {
		super(props);
		this.state = {
			value: props.item.editValue ?? ''
		};
	}

		onKeydown = (event) => {
			const input = event.target;

			if (event.code === 'Escape') {
				if (this.props.item.onCancelEdit !== undefined) this.props.item.onCancelEdit();
				event.preventDefault();
				return false;
			}

			if (event.code === 'Enter') {
				if (event.altKey || event.ctrlKey || event.shiftKey) {
					this.insertNewLine(input);
					this.dispatchInput(input);
					event.preventDefault();
					return false;
				}

				if (this.props.item.onCompleteEdit !== undefined) this.props.item.onCompleteEdit();
				event.preventDefault();
				return false;
			}
		};

		onLostFocus = (event) => {
			console.log('1')
			if (this.props.item.onLostFocus !== undefined) this.props.item.onLostFocus();
			event.stopPropagation();
		}

		onChange =(event) =>{
			const value = event.target.value;
			this.setState({ value });
			this.props.item.editValue = value;
		}

		insertNewLine(input) {
			const cursorPos = input.selectionStart ?? input.value.length;
			const selectionEnd = input.selectionEnd ?? cursorPos;
			const value = input.value;
			const newline = "\r\n";
			input.value = value.substring(0, cursorPos) + newline + value.substring(selectionEnd);
			const newPos = cursorPos + newline.length;
			input.selectionStart = newPos;
			input.selectionEnd = newPos;
		}

		dispatchInput(input) {
			input.dispatchEvent(new Event('input', { bubbles: true }));
		}

		render() {
		return (
			<TextArea
				className="EditItem"
				onKeyDown={this.onKeydown}
				onChange={this.onChange}
				onBlur={this.onLostFocus}
				value={this.state.value}
				autoFocus
				autoSize={{ minRows: Math.max(2,this.props.item.title.split("\n").length)}}
			/>
		)
	}
}
