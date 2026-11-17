import classic from 'Themes/classic';

/** Классическое оформление с красно-синими статусами вместо красно-зелёных. */
const accessible = {
	...classic,
	id: 'accessible',
	name: 'accessible',
	description: 'Красные статусы сохранены, зелёные заменены синими.',
	extends: 'classic',
	// AntD использует ту же семантику цветов, что и карточки приложения.
	antd: {
		token: {
			...classic.antd.token,
			colorSuccess: '#0072b2',
		},
	},
};

export default accessible;
