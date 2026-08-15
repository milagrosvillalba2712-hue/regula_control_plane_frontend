import type { ThemeConfig } from 'antd';

export const controlPlaneTheme: ThemeConfig = {
  token: {
    colorPrimary: '#de7426',
    colorSuccess: '#2f9e44',
    colorWarning: '#f2994a',
    colorError: '#ba1a1a',
    colorInfo: '#00658d',
    colorTextBase: '#1a2a36',
    colorBgBase: '#f7f9fc',
    borderRadius: 8,
    controlHeight: 38,
    fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  components: {
    Layout: {
      bodyBg: '#f7f9fc',
      siderBg: '#314653',
      headerBg: '#ffffff',
    },
    Menu: {
      darkItemBg: '#314653',
      darkSubMenuItemBg: '#314653',
      darkItemSelectedBg: '#de7426',
      darkItemColor: 'rgba(255,255,255,0.76)',
      darkItemHoverColor: '#ffffff',
      darkItemSelectedColor: '#ffffff',
    },
    Card: {
      borderRadiusLG: 10,
    },
    Table: {
      headerBg: '#f2f4f7',
      headerColor: '#4e616e',
      rowHoverBg: '#f7f9fc',
    },
    Statistic: {
      titleFontSize: 13,
      contentFontSize: 24,
    },
  },
};
