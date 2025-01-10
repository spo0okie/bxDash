
import React from "react";
import {get} from 'mobx';
import './EditItem.css';
//TODO https://www.npmjs.com/package/react-textarea-autosize
import { Input } from 'antd';

const { TextArea } = Input;

export default class EditItem extends React.Component {

	onKeydown = (event) => {
		//console.log(event)
        const input=event.target;

        if (event.code === 'Escape') {
			//console.log(this.props.item);
            if (this.props.item.onCancelEdit!==undefined) this.props.item.onCancelEdit();
            event.preventDefault();
            return false;
        }

        if (event.code === "Enter" && event.altKey) {	//Alt+Enter
            if (input.selectionStart || input.selectionStart === 0) {	//курсор где-то в тексте или в самом начале - надо разорвать текст
                let startPos   = input.selectionStart;
                const endPos   = input.selectionEnd;
                const curValue = input.value;
                input.value=(
                    curValue.substring(0, startPos)
                    + "\r\n"
                    + curValue.substring(endPos, curValue.length)
                );
                startPos++;
                input.selectionStart=startPos;
                input.selectionEnd=startPos;
            } else {
                input.value=input.value + "\r\n";
            }
            event.preventDefault();
        }

        if (event.key === "Enter" && !event.altKey) {
            if (this.props.item.onCompleteEdit!==undefined) this.props.item.onCompleteEdit();
            event.preventDefault();
            return false;
        }

		//без этой хрени не работает авторесайз, т.к. мы перехватили нажатие клавиш
		const fakeEvent = new Event('input', { bubbles: true });
		input.dispatchEvent(fakeEvent);
		return false;
	};

	onLostFocus = (event) => {
		console.log('1')
		if (this.props.item.onLostFocus!==undefined) this.props.item.onLostFocus();
		event.stopPropagation();
	}

	onChange =(event) =>{
		/*const changes={
			id: this.props.item.id,
			title: event.target.value,
		}*/
		this.props.item.editValue = event.target.value;
	}

    render() {
        return (
            <TextArea
			className="EditItem" 
			onKeyDown={this.onKeydown}
			onChange={this.onChange}
			onBlur={this.onLostFocus}
			defaultValue={this.props.item.editValue}
			autoFocus
			//resize={'none'}
			autoSize={{ minRows: Math.max(2,this.props.item.title.split("\n").length)}} 
			/>
        )
		//$input.focus();

    }
}
