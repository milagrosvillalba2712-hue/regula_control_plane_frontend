import type React from 'react';
import { useEffect, useMemo, useState } from 'react';
import ReactDOM from 'react-dom/client';
import {
  ApiOutlined,
  BankOutlined,
  CloudServerOutlined,
  CreditCardOutlined,
  DatabaseOutlined,
  LockOutlined,
  LogoutOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { Column, Line, Pie } from '@ant-design/charts';
import {
  Alert,
  App as AntdApp,
  Avatar,
  Button,
  Card,
  Col,
  ConfigProvider,
  Descriptions,
  Empty,
  Form,
  Input,
  Layout,
  Menu,
  Progress,
  Row,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { controlPlaneTheme } from './theme';
import './index.css';

type SectionKey = 'dashboard' | 'empresas' | 'planes' | 'instalaciones' | 'catalogos';

interface Session {
  token: string;
  usuario: Record<string, unknown>;
  permisos: string[];
}

interface LoadErrors {
  empresas?: string;
  planes?: string;
  instalaciones?: string;
  catalogos?: string;
  overview?: string;
}

const SESSION_KEY = 'regula-control-plane-session';
const ADMIN_API_KEY = import.meta.env.VITE_CONTROL_PLANE_ADMIN_KEY || 'change-me-admin';
const ADMIN_EMAIL_HINT = import.meta.env.VITE_CONTROL_PLANE_ADMIN_EMAIL || 'admin@regula.local';

const apiRequest = async <T,>(path: string, session?: Session | null, body?: unknown): Promise<T> => {
  const response = await fetch(path, {
    method: body ? 'POST' : 'GET',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': ADMIN_API_KEY,
      ...(session?.token ? { Authorization: `Bearer ${session.token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(String(payload.mensaje || payload.message || payload.error || `HTTP ${response.status}`));
  }
  return response.json() as Promise<T>;
};

const App = () => {
  const [session, setSession] = useState<Session | null>(() => readSession());

  const onLogin = (nextSession: Session) => {
    localStorage.setItem(SESSION_KEY, JSON.stringify(nextSession));
    setSession(nextSession);
  };

  const onLogout = () => {
    localStorage.removeItem(SESSION_KEY);
    setSession(null);
  };

  return session ? <ControlPlaneConsole session={session} onLogout={onLogout} /> : <LoginPage onLogin={onLogin} />;
};

const LoginPage = ({ onLogin }: { onLogin: (session: Session) => void }) => {
  const [loading, setLoading] = useState(false);

  const submit = async (values: { email: string; password: string }) => {
    setLoading(true);
    try {
      const data = await apiRequest<Session>('/api/admin/login', null, values);
      onLogin(data);
      message.success('Sesión iniciada en Regula Control Plane');
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'No se pudo iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout style={{ minHeight: '100vh', background: '#f7f9fc' }}>
      <Layout.Content style={{ display: 'grid', placeItems: 'center', padding: 24 }}>
        <Card style={{ width: '100%', maxWidth: 480 }} styles={{ body: { padding: 32 } }}>
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <Space align="center" size="middle">
              <Avatar size={52} style={{ backgroundColor: '#de7426' }} icon={<CloudServerOutlined />} />
              <div>
                <Typography.Title level={2} style={{ margin: 0 }}>Regula Control Plane</Typography.Title>
                <Typography.Text type="secondary">Administración central de licencias, clientes y catálogos.</Typography.Text>
              </div>
            </Space>
            <Alert
              type="info"
              showIcon
              message="Credencial Demo"
              description={`Usuario sugerido: ${ADMIN_EMAIL_HINT}. La API key se toma desde el .env del frontend.`}
            />
            <Form layout="vertical" onFinish={submit} initialValues={{ email: ADMIN_EMAIL_HINT }}>
              <Form.Item label="Correo" name="email" rules={[{ required: true, message: 'Ingresa el correo' }]}>
                <Input prefix={<UserOutlined />} placeholder="admin@regula.local" autoComplete="username" />
              </Form.Item>
              <Form.Item label="Contraseña" name="password" rules={[{ required: true, message: 'Ingresa la contraseña' }]}>
                <Input.Password prefix={<LockOutlined />} placeholder="Contraseña del Control Plane" autoComplete="current-password" />
              </Form.Item>
              <Button type="primary" htmlType="submit" block loading={loading}>
                Ingresar
              </Button>
            </Form>
          </Space>
        </Card>
      </Layout.Content>
    </Layout>
  );
};

const ControlPlaneConsole = ({ session, onLogout }: { session: Session; onLogout: () => void }) => {
  const [section, setSection] = useState<SectionKey>('dashboard');
  const [companies, setCompanies] = useState<Record<string, unknown>[]>([]);
  const [plans, setPlans] = useState<Record<string, unknown>[]>([]);
  const [installations, setInstallations] = useState<Record<string, unknown>[]>([]);
  const [manifest, setManifest] = useState<Record<string, unknown>>({});
  const [systemOverview, setSystemOverview] = useState<Record<string, unknown>>({});
  const [loadErrors, setLoadErrors] = useState<LoadErrors>({});
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const [companiesResult, plansResult, installationsResult, manifestResult, overviewResult] = await Promise.all([
      safeLoad('empresas', () => apiRequest<Record<string, unknown>[]>('/api/admin/companies', session), []),
      safeLoad('planes', () => apiRequest<Record<string, unknown>[]>('/api/admin/plans', session), []),
      safeLoad('instalaciones', () => apiRequest<Record<string, unknown>[]>('/api/admin/installations', session), []),
      safeLoad('catalogos', () => apiRequest<Record<string, unknown>>('/api/v1/catalogs/manifest', session), {}),
      safeLoad('overview', () => apiRequest<Record<string, unknown>>('/api/admin/system-overview', session), {}),
    ]);
    setCompanies(companiesResult.data);
    setPlans(plansResult.data);
    setInstallations(installationsResult.data);
    setManifest(manifestResult.data);
    setSystemOverview(overviewResult.data);
    setLoadErrors({
      empresas: companiesResult.error,
      planes: plansResult.error,
      instalaciones: installationsResult.error,
      catalogos: manifestResult.error,
      overview: overviewResult.error,
    });
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const catalogs = useMemo(() => arrayValue(manifest.catalogs), [manifest]);
  const activeCompanies = companies.filter((company) => String(company.estado || '').toUpperCase() === 'ACTIVA').length;
  const activePlans = plans.filter((plan) => plan.activo !== false).length;
  const activeInstallations = installations.filter((item) => String(item.estado || '').toUpperCase().includes('ACTIV')).length;
  const activeTitle = sectionTitle(section);

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Layout.Sider width={264} style={{ position: 'sticky', top: 0, height: '100vh', overflow: 'auto' }}>
        <div className="control-plane-brand">
          <Typography.Title className="control-plane-brand__title" level={4}>Regula</Typography.Title>
          <Typography.Text style={{ color: 'rgba(255,255,255,0.68)' }}>Control Plane Central</Typography.Text>
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[section]}
          onClick={({ key }) => setSection(key as SectionKey)}
          items={[
            { key: 'dashboard', icon: <CloudServerOutlined />, label: 'Tablero' },
            { key: 'empresas', icon: <BankOutlined />, label: 'Empresas' },
            { key: 'planes', icon: <CreditCardOutlined />, label: 'Planes' },
            { key: 'instalaciones', icon: <SafetyCertificateOutlined />, label: 'Instalaciones' },
            { key: 'catalogos', icon: <DatabaseOutlined />, label: 'Catálogos' },
          ]}
        />
      </Layout.Sider>
      <Layout>
        <Layout.Header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingInline: 24, borderBottom: '1px solid #eef1f5' }}>
          <Space>
            <Avatar style={{ backgroundColor: '#de7426' }}>{String(session.usuario.email || 'A').charAt(0).toUpperCase()}</Avatar>
            <Space direction="vertical" size={0}>
              <Typography.Text strong>{activeTitle}</Typography.Text>
              <Typography.Text type="secondary">{String(session.usuario.nombre || session.usuario.email || 'Administrador General')}</Typography.Text>
            </Space>
          </Space>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>Actualizar</Button>
            <Button icon={<LogoutOutlined />} onClick={onLogout}>Salir</Button>
          </Space>
        </Layout.Header>
        <Layout.Content style={{ padding: 24 }}>
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <ErrorSummary errors={loadErrors} />
            {section === 'dashboard' && (
              <DashboardSection
                loading={loading}
                companies={companies}
                plans={plans}
                installations={installations}
                catalogs={catalogs}
                systemOverview={systemOverview}
                activeCompanies={activeCompanies}
                activePlans={activePlans}
                activeInstallations={activeInstallations}
                manifest={manifest}
              />
            )}
            {section === 'empresas' && <DataSection title="Empresas Clientes" rows={companies} loading={loading} />}
            {section === 'planes' && <DataSection title="Planes Comerciales" rows={plans} loading={loading} />}
            {section === 'instalaciones' && <DataSection title="Instalaciones On-Premise" rows={installations} loading={loading} />}
            {section === 'catalogos' && (
              <DataSection
                title="Catálogos Publicados"
                rows={catalogs}
                loading={loading}
                description={`Versión paquete: ${String(manifest.packageVersion || '-')}`}
              />
            )}
          </Space>
        </Layout.Content>
      </Layout>
    </Layout>
  );
};

const ErrorSummary = ({ errors }: { errors: LoadErrors }) => {
  const activeErrors = Object.entries(errors).filter(([, value]) => Boolean(value));
  if (activeErrors.length === 0) return null;
  return (
    <Alert
      type="warning"
      showIcon
      message="Carga Parcial Del Control Plane"
      description={activeErrors.map(([key, value]) => `${titleize(key)}: ${value}`).join(' | ')}
    />
  );
};

const DashboardSection = ({
  loading,
  companies,
  plans,
  installations,
  catalogs,
  systemOverview,
  activeCompanies,
  activePlans,
  activeInstallations,
  manifest,
}: {
  loading: boolean;
  companies: Record<string, unknown>[];
  plans: Record<string, unknown>[];
  installations: Record<string, unknown>[];
  catalogs: Record<string, unknown>[];
  systemOverview: Record<string, unknown>;
  activeCompanies: number;
  activePlans: number;
  activeInstallations: number;
  manifest: Record<string, unknown>;
}) => {
  const companyStatus = groupRows(companies, 'estado', 'Sin Estado');
  const installationStatus = groupRows(installations, 'estado', 'Sin Estado');
  const planLimits = plans.flatMap((plan) => [
    { plan: String(plan.codigo || plan.nombre || 'Plan'), tipo: 'Usuarios', valor: Number(plan.users || 0) },
    { plan: String(plan.codigo || plan.nombre || 'Plan'), tipo: 'Reglas', valor: Number(plan.rules || 0) },
    { plan: String(plan.codigo || plan.nombre || 'Plan'), tipo: 'Reportes', valor: Number(plan.reportsMonth || 0) },
  ]);
  const firstPlan = plans[0] || {};
  const database = asRecord(systemOverview.database);
  const latency = asRecord(systemOverview.apiLatency);
  const uptime = asRecord(systemOverview.systemUptime);
  const trafficTrend = arrayValue(systemOverview.trafficTrend24h);
  const errorTelemetry = arrayValue(systemOverview.errorTelemetry);
  const companyUsage = arrayValue(systemOverview.companies);

  return (
    <Space className="observability-dashboard" direction="vertical" size="middle">
      <div className="observability-toolbar">
        <div>
          <div className="observability-kicker">Control Plane Central</div>
          <Typography.Title level={3} style={{ margin: 0 }}>Regula Multiempresa</Typography.Title>
          <Typography.Text>Empresas cliente, planes, instalaciones, catálogos y telemetría agregada.</Typography.Text>
        </div>
        <Space wrap>
          <Tag color="success">{activeCompanies} Empresas Activas</Tag>
          <Tag color="processing">Demo Santa Clara</Tag>
        </Space>
      </div>
      <Row gutter={[16, 16]}>
        <Metric title="Carga De Base De Datos" value={numberValue(database.loadPercent)} suffix="%" icon={<DatabaseOutlined />} loading={loading} />
        <Metric title="Latencia API" value={numberValue(latency.avgMs)} suffix="ms" icon={<ApiOutlined />} loading={loading} />
        <Metric title="Conexiones Activas" value={numberValue(systemOverview.activeConnections)} icon={<CloudServerOutlined />} loading={loading} />
        <Metric title="Tiempo Activo Del Sistema" value={String(uptime.display || '-')} icon={<SafetyCertificateOutlined />} loading={loading} />
      </Row>
      <Row gutter={[16, 16]}>
        <Metric title="Empresas Activas" value={activeCompanies} total={companies.length} icon={<BankOutlined />} loading={loading} />
        <Metric title="Planes Activos" value={activePlans} total={plans.length} icon={<CreditCardOutlined />} loading={loading} />
        <Metric title="Instalaciones Activas" value={activeInstallations} total={installations.length} icon={<SafetyCertificateOutlined />} loading={loading} />
        <Metric title="Catálogos Publicados" value={catalogs.length} icon={<ApiOutlined />} loading={loading} />
      </Row>
      <Row gutter={[16, 16]}>
        <Col xs={24} xl={15}>
          <ChartCard title="Tráfico De APIs" loading={loading} empty={trafficTrend.length === 0}>
            <Line
              data={trafficTrend.flatMap((row) => [
                { hora: formatHour(row.bucket), tipo: 'API Administración', valor: numberValue(row.api_admin) },
                { hora: formatHour(row.bucket), tipo: 'API Clientes', valor: numberValue(row.api_cliente) },
                { hora: formatHour(row.bucket), tipo: 'Errores API', valor: numberValue(row.api_errores) },
                { hora: formatHour(row.bucket), tipo: 'Validaciones De Licencia', valor: numberValue(row.heartbeats) },
                { hora: formatHour(row.bucket), tipo: 'Consumo', valor: numberValue(row.consumo_reportado) },
                { hora: formatHour(row.bucket), tipo: 'Auditoría', valor: numberValue(row.auditoria) },
              ])}
              xField="hora"
              yField="valor"
              seriesField="tipo"
              height={260}
              smooth
              legend={{ position: 'bottom' }}
            />
          </ChartCard>
        </Col>
        <Col xs={24} xl={9}>
          <Card title="Telemetría De Errores" loading={loading} styles={{ body: { background: '#111827', color: '#e5e7eb', minHeight: 260 } }}>
            <Space direction="vertical" style={{ width: '100%' }}>
              {errorTelemetry.slice(0, 8).map((row, index) => (
                <div key={String(row.referencia ?? row.fecha ?? index)} style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 10 }}>
                  <Typography.Text style={{ color: '#f87171', fontSize: 12 }}>{String(row.codigo || 'ERR')} </Typography.Text>
                  <Typography.Text style={{ color: '#94a3b8', fontSize: 12 }}>{formatHour(row.fecha)}</Typography.Text>
                  <Typography.Text style={{ color: '#ffffff', display: 'block', fontSize: 12 }}>{String(row.origen || 'api_endpoint')}</Typography.Text>
                  <Typography.Text style={{ color: '#cbd5e1', display: 'block', fontSize: 12 }}>{String(row.mensaje || '-')}</Typography.Text>
                </div>
              ))}
              {errorTelemetry.length === 0 && <Typography.Text style={{ color: '#cbd5e1' }}>Sin errores registrados.</Typography.Text>}
            </Space>
          </Card>
        </Col>
      </Row>
      <Row gutter={[16, 16]}>
        <Col xs={24} xl={8}>
          <ChartCard title="Empresas Por Estado" loading={loading} empty={companyStatus.length === 0}>
            <Pie data={companyStatus} angleField="total" colorField="nombre" height={260} innerRadius={0.62} legend={{ position: 'bottom' }} />
          </ChartCard>
        </Col>
        <Col xs={24} xl={8}>
          <ChartCard title="Instalaciones Por Estado" loading={loading} empty={installationStatus.length === 0}>
            <Pie data={installationStatus} angleField="total" colorField="nombre" height={260} innerRadius={0.62} legend={{ position: 'bottom' }} />
          </ChartCard>
        </Col>
        <Col xs={24} xl={8}>
          <ChartCard title="Límites Por Plan" loading={loading} empty={planLimits.length === 0}>
            <Column data={planLimits} xField="plan" yField="valor" seriesField="tipo" height={260} legend={{ position: 'bottom' }} />
          </ChartCard>
        </Col>
      </Row>
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card title="Lectura Ejecutiva" loading={loading}>
            <Descriptions column={1} size="small" items={[
              { key: 'paquete', label: 'Paquete De Catálogos', children: String(manifest.packageVersion || '-') },
              { key: 'plan', label: 'Plan Base', children: String(firstPlan.nombre || firstPlan.codigo || '-') },
              { key: 'db', label: 'Carga De Base De Datos', children: `${numberValue(database.activeConnections)} / ${numberValue(database.maxConnections)} conexiones` },
              { key: 'uptime', label: 'Tiempo Activo', children: String(uptime.display || '-') },
            ]} />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="Cobertura Operativa" loading={loading}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Coverage label="Empresas Activas" value={percentage(activeCompanies, companies.length)} />
              <Coverage label="Planes Activos" value={percentage(activePlans, plans.length)} />
              <Coverage label="Instalaciones Activas" value={percentage(activeInstallations, installations.length)} />
            </Space>
          </Card>
        </Col>
      </Row>
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <DataCard title="Empresas Clientes" rows={companies} loading={loading} />
        </Col>
        <Col xs={24} lg={12}>
          <DataCard title="Consumo Por Empresa" rows={companyUsage} loading={loading} />
        </Col>
      </Row>
    </Space>
  );
};

const Metric = ({ title, value, total, suffix, icon, loading }: {
  title: string;
  value: number | string;
  total?: number;
  suffix?: string;
  icon: React.ReactNode;
  loading: boolean;
}) => (
  <Col xs={24} md={12} xl={6}>
    <Card>
      <Statistic title={title} value={value} suffix={suffix || (total !== undefined ? `/ ${total}` : undefined)} prefix={icon} loading={loading} />
    </Card>
  </Col>
);

const ChartCard = ({ title, loading, empty, children }: {
  title: string;
  loading: boolean;
  empty: boolean;
  children: React.ReactNode;
}) => (
  <Card title={title} loading={loading}>
    {empty ? <Empty description="Sin datos para graficar" /> : children}
  </Card>
);

const Coverage = ({ label, value }: { label: string; value: number }) => (
  <div>
    <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 6 }}>
      <Typography.Text>{label}</Typography.Text>
      <Typography.Text strong>{value}%</Typography.Text>
    </Space>
    <Progress percent={value} status={value >= 80 ? 'success' : value >= 50 ? 'normal' : 'exception'} />
  </div>
);

const DataSection = ({ title, rows, loading, description }: {
  title: string;
  rows: Record<string, unknown>[];
  loading: boolean;
  description?: string;
}) => (
  <Space direction="vertical" size="middle" style={{ width: '100%' }}>
    {description && <Alert type="info" showIcon message={description} />}
    <DataCard title={title} rows={rows} loading={loading} />
  </Space>
);

const DataCard = ({ title, rows, loading, description }: {
  title: string;
  rows: Record<string, unknown>[];
  loading: boolean;
  description?: string;
}) => (
  <Card title={title} loading={loading}>
    {description && <Typography.Paragraph type="secondary">{description}</Typography.Paragraph>}
    <Table
      rowKey={(row: Record<string, unknown>, index?: number) => String(row.id ?? row.codigo ?? row.code ?? index)}
      size="small"
      dataSource={rows}
      columns={columns(rows)}
      pagination={{ pageSize: 8, showSizeChanger: true }}
      scroll={{ x: true }}
      locale={{ emptyText: <Empty description="Sin registros disponibles" /> }}
    />
  </Card>
);

const columns = (rows: Record<string, unknown>[]): ColumnsType<Record<string, unknown>> => {
  const keys = Array.from(new Set(rows.flatMap((row) => Object.keys(row)))).slice(0, 8);
  return keys.map((key) => ({
    title: titleize(key),
    dataIndex: key,
    ellipsis: true,
    render: (value: unknown) => renderValue(key, value),
  }));
};

const renderValue = (key: string, value: unknown) => {
  if (value === null || value === undefined || value === '') return '-';
  if (typeof value === 'boolean') return value ? <Tag color="green">Sí</Tag> : <Tag>No</Tag>;
  if (key.toLowerCase().includes('estado')) return <StatusTag value={String(value)} />;
  if (typeof value === 'object') return JSON.stringify(value);
  if (String(value).length > 48) return <Tag>{String(value).slice(0, 18)}...</Tag>;
  return String(value);
};

const StatusTag = ({ value }: { value: string }) => {
  const normalized = value.toUpperCase();
  const color = normalized.includes('ACTIV') || normalized.includes('VIGENTE') ? 'green'
    : normalized.includes('SUSP') || normalized.includes('BLOQ') || normalized.includes('ERROR') ? 'red'
      : normalized.includes('GRACIA') || normalized.includes('PEND') ? 'orange'
        : 'blue';
  return <Tag color={color}>{value}</Tag>;
};

const safeLoad = async <T,>(label: keyof LoadErrors, loader: () => Promise<T>, fallback: T): Promise<{ data: T; error?: string }> => {
  try {
    return { data: await loader() };
  } catch (error) {
    return { data: fallback, error: error instanceof Error ? error.message : `No se pudo cargar ${label}` };
  }
};

const groupRows = (rows: Record<string, unknown>[], field: string, fallback: string) => {
  const counts = rows.reduce<Record<string, number>>((acc, row) => {
    const key = String(row[field] || fallback);
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  return Object.entries(counts).map(([nombre, total]) => ({ nombre, total }));
};

const arrayValue = (value: unknown): Record<string, unknown>[] => {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object' && !Array.isArray(item));
};

const asRecord = (value: unknown): Record<string, unknown> => {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
  return {};
};

const numberValue = (value: unknown): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatHour = (value: unknown): string => {
  if (!value) return '-';
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit' });
};

const percentage = (value: number, total: number) => {
  if (total <= 0) return 0;
  return Math.round((value / total) * 100);
};

const sectionTitle = (section: SectionKey) => ({
  dashboard: 'Tablero',
  empresas: 'Empresas',
  planes: 'Planes Comerciales',
  instalaciones: 'Instalaciones',
  catalogos: 'Catálogos',
}[section]);

const titleize = (value: string) => value
  .replace(/([a-z])([A-Z])/g, '$1 $2')
  .replaceAll('_', ' ')
  .replace(/\b\w/g, (letter) => letter.toUpperCase());

const readSession = (): Session | null => {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) as Session : null;
  } catch {
    localStorage.removeItem(SESSION_KEY);
    return null;
  }
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <ConfigProvider theme={controlPlaneTheme}>
    <AntdApp>
      <App />
    </AntdApp>
  </ConfigProvider>,
);
