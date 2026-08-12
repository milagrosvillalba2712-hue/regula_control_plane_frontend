import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import {
  ApiOutlined,
  BankOutlined,
  CloudSyncOutlined,
  CreditCardOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons';
import { Button, Card, Col, ConfigProvider, Layout, Row, Space, Statistic, Table, Tag, Typography, message } from 'antd';

const API_KEY = import.meta.env.VITE_CONTROL_PLANE_ADMIN_KEY || 'change-me-admin';

const request = async <T,>(path: string): Promise<T> => {
  const response = await fetch(path, { headers: { 'X-API-Key': API_KEY } });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json() as Promise<T>;
};

const App = () => {
  const [companies, setCompanies] = useState<Record<string, unknown>[]>([]);
  const [plans, setPlans] = useState<Record<string, unknown>[]>([]);
  const [installations, setInstallations] = useState<Record<string, unknown>[]>([]);
  const [manifest, setManifest] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [companiesData, plansData, installationsData, manifestData] = await Promise.all([
        request<Record<string, unknown>[]>('/api/admin/companies'),
        request<Record<string, unknown>[]>('/api/admin/plans'),
        request<Record<string, unknown>[]>('/api/admin/installations'),
        request<Record<string, unknown>>('/api/v1/catalogs/manifest'),
      ]);
      setCompanies(companiesData);
      setPlans(plansData);
      setInstallations(installationsData);
      setManifest(manifestData);
    } catch {
      message.error('No se pudo cargar el Control Plane');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  return (
    <ConfigProvider theme={{ token: { colorPrimary: '#f97316', borderRadius: 8 } }}>
      <Layout style={{ minHeight: '100vh' }}>
        <Layout.Header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#111827' }}>
          <Typography.Title level={3} style={{ color: 'white', margin: 0 }}>Regula Control Plane</Typography.Title>
          <Button icon={<CloudSyncOutlined />} onClick={load} loading={loading}>Actualizar</Button>
        </Layout.Header>
        <Layout.Content style={{ padding: 24 }}>
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <Typography.Text type="secondary">
              Consola central de Regula para administrar empresas, planes, instalaciones, licencias y catalogos publicados.
            </Typography.Text>
            <Row gutter={[16, 16]}>
              <Metric title="Empresas" value={companies.length} icon={<BankOutlined />} loading={loading} />
              <Metric title="Planes" value={plans.length} icon={<CreditCardOutlined />} loading={loading} />
              <Metric title="Instalaciones" value={installations.length} icon={<SafetyCertificateOutlined />} loading={loading} />
              <Metric title="Catalogos" value={(manifest.catalogs as unknown[] | undefined)?.length || 0} icon={<ApiOutlined />} loading={loading} />
            </Row>
            <Row gutter={[16, 16]}>
              <Col xs={24} lg={12}><DataCard title="Empresas Clientes" rows={companies} loading={loading} /></Col>
              <Col xs={24} lg={12}><DataCard title="Planes Comerciales" rows={plans} loading={loading} /></Col>
              <Col xs={24} lg={12}><DataCard title="Instalaciones" rows={installations} loading={loading} /></Col>
              <Col xs={24} lg={12}>
                <Card title="Catalogos Publicados" loading={loading}>
                  <Typography.Text>Version paquete: {String(manifest.packageVersion || '-')}</Typography.Text>
                  <Table
                    rowKey={(_, index) => String(index)}
                    size="small"
                    dataSource={(manifest.catalogs as Record<string, unknown>[] | undefined) || []}
                    columns={[
                      { title: 'Codigo', dataIndex: 'code' },
                      { title: 'Version', dataIndex: 'version' },
                      { title: 'Hash', dataIndex: 'sha256', render: (value) => <Tag>{String(value)}</Tag> },
                    ]}
                    pagination={false}
                  />
                </Card>
              </Col>
            </Row>
          </Space>
        </Layout.Content>
      </Layout>
    </ConfigProvider>
  );
};

const Metric = ({ title, value, icon, loading }: { title: string; value: number; icon: React.ReactNode; loading: boolean }) => (
  <Col xs={24} md={12} xl={6}>
    <Card><Statistic title={title} value={value} prefix={icon} loading={loading} /></Card>
  </Col>
);

const DataCard = ({ title, rows, loading }: { title: string; rows: Record<string, unknown>[]; loading: boolean }) => (
  <Card title={title} loading={loading}>
    <Table
      rowKey={(_, index) => String(index)}
      size="small"
      dataSource={rows}
      columns={columns(rows)}
      pagination={false}
      scroll={{ x: true }}
    />
  </Card>
);

const columns = (rows: Record<string, unknown>[]) => {
  const keys = Array.from(new Set(rows.flatMap((row) => Object.keys(row)))).slice(0, 5);
  return keys.map((key) => ({ title: key, dataIndex: key, render: (value: unknown) => String(value ?? '-') }));
};

ReactDOM.createRoot(document.getElementById('root')!).render(<App />);

