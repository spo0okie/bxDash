import React from "react";
import ModalWindow from "./Modal/ModalWindow";
import CreateTicketModal from "Components/Items/CreateTicketModal/CreateTicketModal";

/**
 * Группа модальных окон верхнего уровня. Сами окна сами отслеживают
 * свою видимость через layout.modalVisible / layout.ticketModalVisible.
 */
const Modals = () => (
	<>
		<ModalWindow />
		<CreateTicketModal />
	</>
);

export default Modals;
