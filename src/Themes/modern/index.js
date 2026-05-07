import { theme as antdTheme } from 'antd';

/**
 * Тема "Modern" — диспетчерский интерфейс ИТ-отдела.
 *
 * Спецификация и принципы оформления — docs/ui/modern-theme.md.
 *
 * Использует antd `darkAlgorithm` — единый перекрас всех ~600 внутренних
 * токенов AntD (Modal/Dropdown/Tooltip/Input). Поверх алгоритма — оверрайды
 * под палитру темы (см. tokens.css), чтобы AntD-компоненты совпадали по
 * тону с кастомным UI.
 */
const modern = {
	id: 'modern',
	name: 'Modern',
	description: 'Диспетчерский тёмный интерфейс с единой системой маркировки типов и статусов.',
	extends: null,
	stylesheets: [],
	antd: {
		algorithm: antdTheme.darkAlgorithm,
		token: {
			colorPrimary:           '#3b82f6',
			colorSuccess:           '#22c55e',
			colorWarning:           '#f59e0b',
			colorError:             '#ef4444',
			colorInfo:              '#3b82f6',

			colorBgBase:            '#0a0d12',
			colorBgContainer:       '#1c2230',
			colorBgElevated:        '#2a3142',
			colorBgLayout:          '#0a0d12',
			colorBgSpotlight:       '#2a3142',

			colorText:              '#f1f5f9',
			colorTextSecondary:     '#cbd5e1',
			colorTextTertiary:      '#94a3b8',
			colorTextQuaternary:    '#64748b',

			colorBorder:            '#475569',
			colorBorderSecondary:   '#2a3142',

			borderRadius:           0,
			borderRadiusLG:         0,
			borderRadiusSM:         0,
			controlHeight:          28,
			controlHeightSM:        22,

			fontFamily:             'Inter, "Segoe UI", system-ui, -apple-system, sans-serif',
			fontSize:               12.5,
			fontSizeLG:             14,
			fontSizeSM:             11.5,
		},
	},
};

export default modern;
