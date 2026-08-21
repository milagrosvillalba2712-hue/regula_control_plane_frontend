import type React from 'react';
import { useEffect, useMemo, useState } from 'react';
import ReactDOM from 'react-dom/client';
import {
  ApiOutlined,
  BankOutlined,
  CloudServerOutlined,
  CreditCardOutlined,
  DatabaseOutlined,
  FileTextOutlined,
  LockOutlined,
  LogoutOutlined,
  MailOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  ShoppingCartOutlined,
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
  Modal,
  Popconfirm,
  Progress,
  Row,
  Segmented,
  Select,
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

type SectionKey = 'dashboard' | 'empresas' | 'planes' | 'pagos' | 'instalaciones' | 'catalogos' | 'documentos' | 'invitaciones' | 'solicitudes-roles';
type TimeRangeKey = '5m' | '10m' | '30m' | '1h' | '3h';
type ApiScopeKey = 'TODAS' | 'ADMIN' | 'CLIENTES' | 'ERRORES';
type DashboardFocusKey = 'ERRORES' | 'LATENCIA' | 'TRAFICO' | 'EMPRESAS' | 'LICENCIAS';

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
  documentos?: string;
  pagos?: string;
  invitaciones?: string;
  solicitudes?: string;
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
  const [documents, setDocuments] = useState<Record<string, unknown>[]>([]);
  const [pagos, setPagos] = useState<Record<string, unknown>[]>([]);
  const [invitaciones, setInvitaciones] = useState<Record<string, unknown>[]>([]);
  const [solicitudesRoles, setSolicitudesRoles] = useState<Record<string, unknown>[]>([]);
  const [loadErrors, setLoadErrors] = useState<LoadErrors>({});
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const [companiesResult, plansResult, installationsResult, manifestResult, overviewResult, documentosResult, invitacionesResult, solicitudesResult] = await Promise.all([
      safeLoad('empresas', () => apiRequest<Record<string, unknown>[]>('/api/admin/companies', session), []),
      safeLoad('planes', () => apiRequest<Record<string, unknown>[]>('/api/admin/plans', session), []),
      safeLoad('instalaciones', () => apiRequest<Record<string, unknown>[]>('/api/admin/installations', session), []),
      safeLoad('catalogos', () => apiRequest<Record<string, unknown>>('/api/v1/catalogs/manifest', session), {}),
      safeLoad('overview', () => apiRequest<Record<string, unknown>>('/api/admin/system-overview', session), {}),
      safeLoad('documentos', () => apiRequest<Record<string, unknown>[]>('/api/admin/documentos-legal', session), []),
      safeLoad('invitaciones', () => apiRequest<Record<string, unknown>[]>('/api/admin/backend/invitaciones', session), []),
      safeLoad('solicitudes', () => apiRequest<Record<string, unknown>[]>('/api/admin/backend/solicitud-roles', session), []),
    ]);
    setCompanies(companiesResult.data);
    setPlans(plansResult.data);
    setInstallations(installationsResult.data);
    setManifest(manifestResult.data);
    setSystemOverview(overviewResult.data);
    setDocuments(documentosResult.data);
    setInvitaciones(invitacionesResult.data);
    setSolicitudesRoles(solicitudesResult.data);
    const empresaPagosId = companiesResult.data[0]?.id;
    const pagosResult = empresaPagosId
      ? await safeLoad('pagos', () => apiRequest<Record<string, unknown>[]>(`/api/admin/payments?empresaId=${empresaPagosId}`, session), [])
      : { data: [], error: undefined };
    setPagos(pagosResult.data);
    setLoadErrors({
      empresas: companiesResult.error,
      planes: plansResult.error,
      instalaciones: installationsResult.error,
      catalogos: manifestResult.error,
      overview: overviewResult.error,
      documentos: documentosResult.error,
      pagos: pagosResult.error,
      invitaciones: invitacionesResult.error,
      solicitudes: solicitudesResult.error,
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
            { key: 'pagos', icon: <CreditCardOutlined />, label: 'Pagos Stripe' },
            { key: 'instalaciones', icon: <SafetyCertificateOutlined />, label: 'Instalaciones' },
            { key: 'catalogos', icon: <DatabaseOutlined />, label: 'Catálogos' },
            { key: 'documentos', icon: <FileTextOutlined />, label: 'Documentos Legales' },
            { key: 'invitaciones', icon: <MailOutlined />, label: 'Invitaciones' },
            { key: 'solicitudes-roles', icon: <ShoppingCartOutlined />, label: 'Solicitudes de Roles' },
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
            {section === 'pagos' && <DataSection title="Pagos De Clientes" rows={pagos} loading={loading} description="Pagos registrados en el Control Plane. Las filas Stripe se reconcilian por Checkout Session, Subscription, Invoice y webhooks firmados." />}
            {section === 'instalaciones' && <DataSection title="Instalaciones On-Premise" rows={installations} loading={loading} />}
            {section === 'catalogos' && (
              <DataSection
                title="Catálogos Publicados"
                rows={catalogs}
                loading={loading}
                description={`Versión paquete: ${String(manifest.packageVersion || '-')}`}
              />
            )}
            {section === 'documentos' && (
              <DocumentosLegalesSection session={session} rows={documents} loading={loading} onReload={load} />
            )}
            {section === 'invitaciones' && (
              <DataSection title="Invitaciones Enviadas" rows={invitaciones} loading={loading} description="Invitaciones de usuarios generadas desde las instalaciones del backend." />
            )}
            {section === 'solicitudes-roles' && (
              <DataSection title="Solicitudes de Roles Adicionales" rows={solicitudesRoles} loading={loading} description="Solicitudes de compra de roles adicionales realizadas por las empresas." />
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
  const [range, setRange] = useState<TimeRangeKey>('1h');
  const [apiScope, setApiScope] = useState<ApiScopeKey>('TODAS');
  const [companyFilter, setCompanyFilter] = useState('TODAS');
  const [statusFilter, setStatusFilter] = useState('TODOS');
  const [focus, setFocus] = useState<DashboardFocusKey>('ERRORES');
  const filteredTraffic = useMemo(() => trafficTrend.filter((row) => isWithinRange(row.bucket, range)), [range, trafficTrend]);
  const filteredErrors = useMemo(() => errorTelemetry
    .filter((row) => isWithinRange(row.fecha, range))
    .filter((row) => statusFilter === 'TODOS' || String(row.status_http ?? row.statusCode ?? row.status ?? '') === statusFilter)
    .filter((row) => apiScope === 'TODAS' || String(row.origen ?? '').toUpperCase().includes(apiScope === 'ADMIN' ? 'ADMIN' : apiScope === 'CLIENTES' ? 'CLIENT' : 'ERROR')), [apiScope, errorTelemetry, range, statusFilter]);
  const statusCodes = useMemo(() => Array.from(new Set(errorTelemetry.map((row) => row.status_http ?? row.statusCode ?? row.status).filter(Boolean).map(String))).sort((a, b) => Number(a) - Number(b)), [errorTelemetry]);
  const visibleCompanies = useMemo(() => companyFilter === 'TODAS' ? companyUsage : companyUsage.filter((row) => String(row.empresaId ?? row.empresa_id ?? row.codigo ?? row.nombre) === companyFilter), [companyFilter, companyUsage]);
  const totalTraffic = filteredTraffic.reduce((sum, row) => sum + numberValue(row.api_admin) + numberValue(row.api_cliente), 0);
  const totalApiErrors = filteredTraffic.reduce((sum, row) => sum + numberValue(row.api_errores), 0);
  const errorRate = totalTraffic ? Math.round((totalApiErrors / totalTraffic) * 1000) / 10 : 0;

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Card size="small">
        <Space direction="vertical" style={{ width: '100%' }}>
          <Space align="center" style={{ width: '100%', justifyContent: 'space-between' }} wrap>
            <div>
              <Typography.Text strong>Vista De Observabilidad Multiempresa</Typography.Text>
              <Typography.Paragraph type="secondary" style={{ margin: 0 }}>
                Filtra por empresa, tiempo, API y HTTP para identificar si el problema es global, de un cliente o de un proveedor.
              </Typography.Paragraph>
            </div>
            <Space wrap>
              <Segmented<TimeRangeKey> size="small" value={range} onChange={setRange} options={timeRangeOptions} />
              <Select
                size="small"
                value={companyFilter}
                style={{ width: 190 }}
                onChange={setCompanyFilter}
                options={[
                  { value: 'TODAS', label: 'Todas Las Empresas' },
                  ...companyUsage.map((row) => ({ value: String(row.empresaId ?? row.empresa_id ?? row.codigo ?? row.nombre), label: String(row.nombre ?? row.empresa ?? row.codigo ?? 'Empresa') })),
                ]}
              />
              <Select
                size="small"
                value={apiScope}
                style={{ width: 170 }}
                onChange={setApiScope}
                options={[
                  { value: 'TODAS', label: 'Todas Las APIs' },
                  { value: 'ADMIN', label: 'API Administración' },
                  { value: 'CLIENTES', label: 'API Clientes' },
                  { value: 'ERRORES', label: 'Solo Errores' },
                ]}
              />
              <Select
                size="small"
                value={statusFilter}
                style={{ width: 130 }}
                onChange={setStatusFilter}
                options={[{ value: 'TODOS', label: 'Todos HTTP' }, ...statusCodes.map((code) => ({ value: code, label: `HTTP ${code}` }))]}
              />
            </Space>
          </Space>
        </Space>
      </Card>
      <Row gutter={[16, 16]}>
        <SignalCard title="¿Está Funcionando?" value={String(uptime.display || '-')} label="Tiempo activo del Control Plane" status="success" detail={`${numberValue(database.loadPercent)}% carga DB · ${numberValue(systemOverview.activeConnections)} conexiones`} loading={loading} onOpen={() => setFocus('TRAFICO')} />
        <SignalCard title="¿Dónde Falla?" value={filteredErrors.length} label={`Errores en ${rangeLabel(range)}`} status={filteredErrors.length > 0 ? 'danger' : 'success'} detail={`${errorRate}% de error estimado sobre tráfico filtrado.`} loading={loading} onOpen={() => setFocus('ERRORES')} />
        <SignalCard title="¿Qué Tan Lento Está?" value={`${numberValue(latency.avgMs)}ms`} label={`P95 ${numberValue(latency.p95Ms)}ms`} status={numberValue(latency.avgMs) > 800 ? 'danger' : numberValue(latency.avgMs) > 300 ? 'warning' : 'success'} detail="Latencia agregada de APIs del Control Plane." loading={loading} onOpen={() => setFocus('LATENCIA')} />
        <SignalCard title="¿A Quién Afecta?" value={visibleCompanies.length} label="Empresas dentro del filtro" status="success" detail={`${activeCompanies}/${companies.length} empresas activas.`} loading={loading} onOpen={() => setFocus('EMPRESAS')} />
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
              data={filteredTraffic.flatMap((row) => [
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
          <DataCard title="Consumo Por Empresa" rows={visibleCompanies} loading={loading} />
        </Col>
      </Row>
      <DataCard title={`Drill-Down: ${focusLabel(focus)}`} rows={focusRows(focus, filteredErrors, visibleCompanies, filteredTraffic)} loading={loading} description="Detalle filtrado que permite pasar de una señal agregada al evento, empresa o bucket horario que explica el comportamiento." />
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

const SignalCard = ({ title, value, label, status, detail, loading, onOpen }: {
  title: string;
  value: string | number;
  label: string;
  status: 'success' | 'warning' | 'danger';
  detail: string;
  loading: boolean;
  onOpen: () => void;
}) => {
  const color = status === 'danger' ? '#cf1322' : status === 'warning' ? '#d48806' : '#237804';
  return (
    <Col xs={24} md={12} xl={6}>
      <Card size="small" loading={loading} hoverable onClick={onOpen}>
        <Space direction="vertical" size={4} style={{ width: '100%' }}>
          <Space style={{ width: '100%', justifyContent: 'space-between' }}>
            <Typography.Text strong>{title}</Typography.Text>
            <Tag color={status === 'danger' ? 'red' : status === 'warning' ? 'gold' : 'green'}>{status === 'danger' ? 'Atención' : status === 'warning' ? 'Revisar' : 'OK'}</Tag>
          </Space>
          <Typography.Title level={2} style={{ margin: 0, color }}>{value}</Typography.Title>
          <Typography.Text>{label}</Typography.Text>
          <Typography.Text type="secondary">{detail}</Typography.Text>
        </Space>
      </Card>
    </Col>
  );
};

const timeRangeOptions: Array<{ label: string; value: TimeRangeKey }> = [
  { label: '5min', value: '5m' },
  { label: '10min', value: '10m' },
  { label: '30min', value: '30m' },
  { label: '1hr', value: '1h' },
  { label: '3hrs', value: '3h' },
];

const rangeLabel = (range: TimeRangeKey) => timeRangeOptions.find((option) => option.value === range)?.label || '1hr';

const rangeStart = (range: TimeRangeKey) => {
  const now = Date.now();
  const minutes = range === '5m' ? 5 : range === '10m' ? 10 : range === '30m' ? 30 : range === '1h' ? 60 : 180;
  return now - minutes * 60 * 1000;
};

const isWithinRange = (raw: unknown, range: TimeRangeKey) => {
  if (!raw) return false;
  const value = new Date(String(raw)).getTime();
  return Number.isFinite(value) && value >= rangeStart(range);
};

const focusLabel = (focus: DashboardFocusKey) => ({
  ERRORES: 'Errores Reales',
  LATENCIA: 'Eventos De Latencia',
  TRAFICO: 'Tráfico De APIs',
  EMPRESAS: 'Empresas Afectadas',
  LICENCIAS: 'Licencias',
}[focus]);

const focusRows = (
  focus: DashboardFocusKey,
  errors: Record<string, unknown>[],
  companies: Record<string, unknown>[],
  traffic: Record<string, unknown>[],
) => {
  if (focus === 'EMPRESAS') return companies;
  if (focus === 'TRAFICO') return traffic;
  if (focus === 'LATENCIA') return errors.filter((row) => numberValue(row.duracion_ms ?? row.duracionMs) >= 300);
  if (focus === 'LICENCIAS') return companies.filter((row) => `${row.estado ?? ''}`.toUpperCase().includes('LICEN'));
  return errors;
};

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

const DocumentosLegalesSection = ({ session, rows, loading, onReload }: {
  session: Session;
  rows: Record<string, unknown>[];
  loading: boolean;
  onReload: () => void;
}) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);

  const TIPO_OPTIONS = [
    { value: 'TERMINOS', label: 'Términos y Condiciones' },
    { value: 'POLITICA_PRIVACIDAD', label: 'Política de Privacidad' },
  ];

  const openCreate = () => {
    setEditingId(null);
    form.resetFields();
    form.setFieldsValue({ tipo: 'TERMINOS', activo: true });
    setModalOpen(true);
  };

  const openEdit = (record: Record<string, unknown>) => {
    setEditingId(Number(record.id));
    form.setFieldsValue({
      tipo: record.tipo,
      version: record.version,
      titulo: record.titulo,
      contenido: record.contenido,
      urlDocumento: record.urlDocumento,
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      if (editingId) {
        await apiRequest(`/api/admin/documentos-legal/${editingId}`, session, values);
        message.success('Documento actualizado');
      } else {
        await apiRequest('/api/admin/documentos-legal', session, values);
        message.success('Documento creado');
      }
      setModalOpen(false);
      onReload();
    } catch (error) {
      if (error instanceof Error && error.message !== 'Validation failed') {
        message.error(error.message);
      }
    } finally {
      setSaving(false);
    }
  };

  const handlePublicar = async (id: number) => {
    try {
      await apiRequest(`/api/admin/documentos-legal/${id}/publicar`, session, {});
      message.success('Documento publicado');
      onReload();
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Error al publicar');
    }
  };

  const handleToggleActivo = async (record: Record<string, unknown>) => {
    try {
      await apiRequest(`/api/admin/documentos-legal/${record.id}`, session, { activo: !record.activo });
      message.success(record.activo ? 'Documento desactivado' : 'Documento activado');
      onReload();
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Error al cambiar estado');
    }
  };

  const columns: ColumnsType<Record<string, unknown>> = [
    { title: 'Tipo', dataIndex: 'tipo', key: 'tipo',
      render: (tipo: string) => <Tag color={tipo === 'TERMINOS' ? 'blue' : 'green'}>{tipo === 'TERMINOS' ? 'Términos' : 'Privacidad'}</Tag> },
    { title: 'Versión', dataIndex: 'version', key: 'version', width: 80 },
    { title: 'Título', dataIndex: 'titulo', key: 'titulo', ellipsis: true },
    { title: 'Estado', dataIndex: 'activo', key: 'activo', width: 100,
      render: (activo: boolean) => <Tag color={activo ? 'green' : 'default'}>{activo ? 'Activo' : 'Inactivo'}</Tag> },
    { title: 'Publicado', dataIndex: 'fechaPublicacion', key: 'fechaPublicacion', width: 120,
      render: (fp: unknown) => fp ? new Date(String(fp)).toLocaleDateString('es-PY') : <Tag>Pendiente</Tag> },
    { title: 'Acciones', key: 'acciones', width: 200,
      render: (_: unknown, record: Record<string, unknown>) => (
        <Space>
          <Button size="small" onClick={() => openEdit(record)}>Editar</Button>
          {!record.fechaPublicacion && (
            <Popconfirm title="¿Publicar este documento?" onConfirm={() => handlePublicar(Number(record.id))}>
              <Button size="small" type="primary">Publicar</Button>
            </Popconfirm>
          )}
          <Popconfirm title={record.activo ? '¿Desactivar?' : '¿Activar?'} onConfirm={() => handleToggleActivo(record)}>
            <Button size="small" danger={!!record.activo}>{record.activo ? 'Desactivar' : 'Activar'}</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <>
      <Card title="Documentos Legales" extra={<Button type="primary" onClick={openCreate}>Nuevo Documento</Button>}>
        <Table
          dataSource={rows}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={false}
          size="middle"
        />
      </Card>
      <Modal
        title={editingId ? 'Editar Documento Legal' : 'Nuevo Documento Legal'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleSave}
        confirmLoading={saving}
        width={720}
        okText="Guardar"
      >
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="tipo" label="Tipo" rules={[{ required: true }]}>
                <Select options={TIPO_OPTIONS} disabled={!!editingId} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="version" label="Versión" rules={[{ required: true }]}>
                <Input type="number" disabled={!!editingId} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="titulo" label="Título" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="contenido" label="Contenido" rules={[{ required: true }]}>
            <Input.TextArea rows={12} />
          </Form.Item>
          <Form.Item name="urlDocumento" label="URL alternativa (opcional)">
            <Input />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};

const sectionTitle = (section: SectionKey) => ({
  dashboard: 'Tablero',
  empresas: 'Empresas',
  planes: 'Planes Comerciales',
  pagos: 'Pagos Stripe',
  instalaciones: 'Instalaciones',
  catalogos: 'Catálogos',
  documentos: 'Documentos Legales',
  invitaciones: 'Invitaciones',
  'solicitudes-roles': 'Solicitudes de Roles',
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
