import React, {Component} from "react";
import {observer} from "mobx-react";
import {StoreContext} from "Data/Stores/StoreProvider";
import AppHeader from "./Header/AppHeader";
import InvAuthForm from "./AuthForm/InvAuthForm";
import Interval from "./Interval/Interval";
import ModalWindow from "./Modal/ModalWindow";
import classNames from "classnames";
import "./Layout.css";
import MemoCell from "../MemoCell/MemoCell";
import Sidebar from "./Sidebar/Sidebar";
import ScrollSection from "./ScrollSection/ScrollSection";
import HomeButton from "./Header/Home/HomeButton";


//@withStore
@observer
class Layout extends Component {
  /*toggleTitle = () => {
    const store = this.context.main;
    if (store.testText === "как") {
        store.setText("пук");
    } else {
        store.setText("как");
    }
  };*/

  authForm() {
    const store = this.context.main;
    if (!store.bxAuth) return (<div className="App">
      <InvAuthForm />
    </div>);
  }

  intervals() {
    let output='';
    const time = this.context.time;
    for(let i=time.weekMin; i<=time.weekMax;i++) {output+=(<Interval key={i} id={i} />)}
    return output;
  }

  render() {
    const time = this.context.time;
    const users = this.context.users;
    const layout = this.context.layout;
	const main = this.context.main;
	const personal = (users.selected !== null);
    console.log('layout render');
    return (<>
			{!main.bxAuth && <InvAuthForm />}
			{main.bxAuth && (<>
							<ModalWindow />
							<AppHeader />
							<HomeButton />
				
				<div className="layout">
				{layout.memosVisible && (<Sidebar><MemoCell /></Sidebar>)}
				<div className="dashBoard">
					{/*this.authForm()*/}
					<ScrollSection 
						className={classNames(
							"Calendar",
							{ 'ColumnScroller': personal && !layout.expand }
						)} id='calendarGrid'
						style={{
							width: (personal && !layout.expand)?
								(layout.windowDimensions.width - 200 - (layout.memosVisible?layout.sidebarWidth:0))+'px'
								:null
						}}
					>
						{time.weeksRange(!personal).map((i) => <Interval key={i} id={i} />)}
					</ScrollSection>
				</div>
				{users.selected !== null && (
					<div className="rightPane">
						<Interval key={time.weekMax+1} id={time.weekMax+1} />
					</div>
				)}
			</div>
			</>
		)}
		</>
    );    
  }
}
Layout.contextType=StoreContext;

export default Layout;