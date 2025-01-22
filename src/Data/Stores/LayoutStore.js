/*
Тут мы будем хранить наши настройки раскладки
 */
import 'reflect-metadata';
//import { useState } from 'react';
import {observable, makeObservable, action} from 'mobx';
import { scroller } from 'react-scroll';

class LayoutStore {
    main;
	time;
	users;

    expand = true;  //разбивать недели по дням
	accomplicesVisible = false; //показывать задачи у соисполнителей
	plansVisible = true; //показывать планы
	jobsVisible = true; //показывать работы
	tasksVisible = true; //показывать задачи
	ticketsVisible = true; //показывать заявки
	memosVisible = true; //показывать напоминания
	sidebarWidth = 300;
	scrollbarWidth = 0;

	keepPlanning = false;	//не скрывать относящееся к планам
	keepFavorites = false;	//не скрывать относящееся к избранному
    
	modalVisible = false;
    modal;

    // .struct makes sure observer won't be signaled unless the
    // dimensions object changed in a deepEqual manner.
    windowDimensions = {
        width: window.innerWidth,
        height: window.innerHeight
    }
	
	getScrollbarWidth = () => {
		//const didCompute = useRef(false);
		//const widthRef = useRef(0);
	
		//if (didCompute.current) return widthRef.current;
	
		// Creating invisible container
		const outer = document.createElement('div');
		outer.style.visibility = 'hidden';
		outer.style.overflow = 'scroll'; // forcing scrollbar to appear
		outer.style.msOverflowStyle = 'scrollbar'; // needed for WinJS apps
		document.body.appendChild(outer);
	
		// Creating inner element and placing it in the container
		const inner = document.createElement('div');
		outer.appendChild(inner);
	
		// Calculating difference between container's full width and the child width
		const scrollbarWidth = outer.offsetWidth - inner.offsetWidth;
	
		// Removing temporary elements from the DOM
		outer.parentNode.removeChild(outer);
	
		//didCompute.current = true;
		//widthRef.current = scrollbarWidth;
	
		return scrollbarWidth;
	};

	scrollTo(item,duration=700) {
		scroller.scrollTo(item, {
			duration: duration,
			delay: 0,
			smooth: 'easeInOutQuint',
			containerId: 'calendarGrid',
			offset: -50, // Scrolls to element + 50 pixels down the page
			horizontal: !this.expand && this.users.selected!==null,
			// ... other options
		  });		
	}

	scrollToday(duration=1200) {
		const today=this.expand?this.time.today:this.time.monday0;
		this.scrollTo('period'+today,duration);
	}

	scrollToLastWeek(duration=1200) {
		const lastWeek=this.time.weekStart(this.time.weekMax);
		this.scrollTo('period'+lastWeek,duration);
	}

    setModalVisible(visible) {
        this.modalVisible=visible;
        console.log('visible '+visible);
    }

    setModal(modal,visible=null) {
        this.modal=modal;
        if (modal===null) modal={
            title:null,
            content:null,
            onClose:()=>{},
        }
        if (visible===null) visible=Boolean(modal.content);
        this.setModalVisible(visible);
    }

    setExpand(value) {
        this.expand=value;
        this.saveOption('expand',value);
    }

	setAccomplicesVisible(value) {
		this.accomplicesVisible = value;
		this.saveOption('accomplicesVisible', value);
	}

	setJobsVisible(value) {
		this.jobsVisible = value;
		this.saveOption('jobsVisible', value);
	}

	setPlansVisible(value) {
		this.plansVisible = value;
		this.saveOption('plansVisible', value);
	}

	setTasksVisible(value) {
		this.tasksVisible = value;
		this.saveOption('tasksVisible', value);
	}

	setTicketsVisible(value) {
		this.ticketsVisible = value;
		this.saveOption('ticketsVisible', value);
	}

	setMemosVisible(value) {
		this.memosVisible = value;
		this.saveOption('memosVisible', value);
	}

	setKeepPlanning(value) {
		this.keepPlanning = value;
		this.saveOption('keepPlanning', value);
	}

	setKeepFavorites(value) {
		this.keepFavorites = value;
		this.saveOption('keepFavorites', value);
	}

	setSidebarWidth(value) {
		value=Math.max(150,value);
		value=Math.min(600,value);
		this.sidebarWidth = value;
		this.saveOption('sidebarWidth', value);
	}

    loadOption(name) {return this.main.loadOption('layout.'+name);}
    saveOption(name,value) {return this.main.saveOption('layout.'+name,value,);}

    constructor(main,time,users) {
        this.main=main;
		this.time=time;
		this.users=users;
		this.scrollbarWidth=this.getScrollbarWidth();

        this.expand=this.loadOption('expand')??true;
		this.accomplicesVisible = this.loadOption('accomplicesVisible') ?? false;
		this.jobsVisible = this.loadOption('jobsVisible') ?? true;
		this.plansVisible = this.loadOption('plansVisible') ?? true;
		this.tasksVisible = this.loadOption('tasksVisible') ?? true;
		this.ticketsVisible = this.loadOption('ticketsVisible') ?? true;
		this.memosVisible = this.loadOption('memosVisible') ?? false;
	
		this.keepFavorites = this.loadOption('keepFavorites') ?? false;
		this.keepPlanning = this.loadOption('keepPlanning') ?? false;

		this.sidebarWidth = this.loadOption('sidebarWidth') ?? 300;

        this.setModal(null);
        makeObservable(this,{
            expand: observable,
			accomplicesVisible: observable,
			jobsVisible: observable,
			plansVisible: observable,
            modalVisible: observable,
			ticketsVisible: observable,
			tasksVisible: observable,
			memosVisible: observable,
			
			keepFavorites: observable,
			keepPlanning: observable,

			sidebarWidth: observable,
            
			windowDimensions: observable.struct,
            setModalVisible: action,
            setExpand: action,
			setAccomplicesVisible: action,
			setJobsVisible: action,
			setPlansVisible: action,
			setTasksVisible: action,
			setTicketsVisible: action,
			setKeepFavorites: action,
			setKeepPlanning: action,
			setMemosVisible: action,
			setSidebarWidth: action,
        });
        window.onresize = () => {
            console.log('height => '+window.innerHeight);
            this.windowDimensions = {
                width: window.innerWidth,
                height: window.innerHeight
            }
        }
    }
}

export default LayoutStore;