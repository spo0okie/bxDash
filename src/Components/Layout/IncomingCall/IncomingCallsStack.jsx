import React from "react";
import { observer } from "mobx-react";
import { useStores } from "Data/Stores/StoreProvider";
import IncomingCallCard from "./IncomingCallCard";
import "./IncomingCall.css";

const IncomingCallsStack = observer(() => {
	const { incomingCalls } = useStores();
	if (!incomingCalls || incomingCalls.cards.length === 0) return null;
	return (
		<div className="IncomingCallsStack">
			{incomingCalls.sortedCards.map(card => (
				<IncomingCallCard key={card.key} card={card} />
			))}
		</div>
	);
});

export default IncomingCallsStack;
