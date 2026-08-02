import { ensureShell } from '../components/shell.js';
import { esc, toast } from '../lib/utils.js';
import { getSupabase } from '../lib/supabase.js';

const DEFAULT_DATA = {
  empresarial: [
    { id: 'emp-equipos', icon: '🏢', title: 'Gestión de Equipos', children: ['1. Planificar el levantamiento de inventario','2. Crear plantilla de registro de activos','3. Recorrer cada departamento/área','4. Registrar marca, modelo y serial de cada equipo','5. Registrar número de activo fijo si aplica','6. Verificar estado físico (bueno/regular/malo)','7. Verificar estado funcional (enciende/funciona)','8. Asignar equipo a usuario o departamento','9. Verificar periféricos asociados (monitor, teclado, mouse)','10. Etiquetar equipo con código de barras o QR','11. Ingresar datos en sistema de inventario','12. Verificar garantía vigente y fecha de vencimiento','13. Documentar ubicación física del equipo','14. Conciliar inventario físico vs sistema','15. Generar reporte de inventario actualizado','16. Identificar equipos obsoletos o fuera de servicio','17. Solicitar baja de equipos obsoletos','18. Retirar equipos dados de baja','19. Actualizar base de datos de activos','20. Entregar reporte final a gerencia'] },
    { id: 'emp-despliegue', icon: '🚀', title: 'Despliegue de Equipos', children: ['1. Levantar requisitos del nuevo equipo','2. Verificar disponibilidad de hardware','3. Preparar imagen de S.O. con sysprep','4. Capturar imagen con WDS/Clonezilla/MDT','5. Configurar servidor PXE boot','6. Iniciar equipo por red (PXE)','7. Aplicar imagen al equipo','8. Verificar instalación de S.O.','9. Instalar drivers faltantes','10. Ejecutar Windows Update hasta estar al día','11. Unir equipo al dominio','12. Asignar OU correspondiente','13. Instalar software base (antivirus, office, navegadores)','14. Instalar software específico por departamento','15. Configurar perfiles de usuario','16. Instalar y mapear impresoras de red','17. Verificar aplicación de GPOs','18. Configurar acceso a recursos compartidos','19. Realizar pruebas de funcionamiento completo','20. Verificar conectividad de red e internet','21. Verificar acceso a aplicaciones críticas','22. Entregar equipo al usuario','23. Firma de conformidad de entrega','24. Documentar equipo entregado en inventario'] },
    { id: 'emp-reemplazo', icon: '🔄', title: 'Reemplazo de Equipos', children: ['1. Identificar equipo a reemplazar','2. Notificar al usuario del reemplazo','3. Coordinar fecha y hora del reemplazo','4. Realizar backup completo de datos del usuario','5. Exportar favoritos y configuraciones de navegador','6. Exportar firmas y reglas de correo','7. Documentar periféricos conectados','8. Preparar nuevo equipo con imagen corporativa','9. Instalar software base y específico','10. Unir nuevo equipo al dominio','11. Migrar perfiles y configuraciones','12. Restaurar datos del usuario','13. Configurar cuentas de correo','14. Reconfigurar periféricos (impresora, escáner, etc.)','15. Verificar aplicaciones críticas','16. Verificar acceso a recursos compartidos','17. Realizar pruebas de funcionamiento','18. Retirar equipo antiguo del dominio','19. Dar de baja equipo antiguo en inventario','20. Limpieza segura de disco (wipe) del equipo antiguo','21. Entregar nuevo equipo al usuario','22. Capacitación sobre cambios si aplica','23. Actualizar inventario con nuevo equipo','24. Documentar reemplazo completado'] },
    { id: 'emp-antivirus', icon: '🔐', title: 'Configuración de Antivirus', children: ['1. Evaluar solución antivirus corporativa','2. Verificar requisitos del servidor de administración','3. Instalar servidor de consola de antivirus','4. Configurar base de datos de la consola','5. Crear políticas de protección','6. Configurar política de protección en tiempo real','7. Configurar política de escaneo programado diario','8. Configurar política de escaneo programado semanal','9. Configurar exclusiones por aplicación','10. Configurar acciones automáticas ante amenazas','11. Configurar notificaciones por correo','12. Descargar agente endpoint','13. Desplegar agente por GPO a todos los equipos','14. Verificar instalación del agente en cada equipo','15. Confirmar comunicación agente-servidor','16. Ejecutar escaneo inicial completo en todos los equipos','17. Actualizar firmas de virus','18. Configurar aislamiento automático de equipos infectados','19. Monitorear amenazas detectadas en consola','20. Generar reporte de estado de protección','21. Configurar escaneo profundo bajo demanda','22. Documentar políticas configuradas','23. Programar revisión mensual de políticas','24. Reporte de incidentes de seguridad'] },
    { id: 'emp-usuarios', icon: '👤', title: 'Gestión de Usuarios AD', children: ['1. Recibir solicitud de creación de usuario','2. Verificar autorización del supervisor','3. Crear cuenta en Active Directory','4. Asignar nombre de usuario según política','5. Asignar contraseña temporal','6. Configurar "cambiar contraseña en próximo inicio"','7. Asignar a OU correspondiente','8. Asignar grupos de seguridad','9. Configurar buzón Exchange/Office 365','10. Asignar licencia de Office 365','11. Configurar MFA (multi-factor)','12. Agregar a grupos de distribución','13. Configurar permisos de archivos compartidos','14. Configurar acceso a aplicaciones específicas','15. Mapear unidades de red','16. Configurar impresoras por defecto','17. Verificar acceso por VPN si aplica','18. Entregar credenciales al usuario','19. Capacitar al usuario en uso de cuenta','20. Documentar cuenta creada','21. Para bajas: suspender cuenta','22. Revocar permisos y grupos','23. Revocar licencias','24. Realizar backup de datos del usuario','25. Deshabilitar buzón','26. Documentar baja de cuenta'] },
    { id: 'emp-firewall', icon: '🛡️', title: 'Configuración de Firewall', children: ['1. Levantar requisitos de tráfico con gerencia de IT','2. Identificar servicios que requieren acceso externo','3. Identificar servicios que requieren acceso interno','4. Acceder al firewall por consola web o SSH','5. Realizar backup de configuración actual','6. Definir zonas de red (LAN, WAN, DMZ, VPN)','7. Configurar reglas de entrada (inbound)','8. Configurar reglas de salida (outbound)','9. Bloquear puertos innecesarios','10. Configurar NAT para servicios públicos','11. Configurar PAT si aplica','12. Configurar VPN site-to-site','13. Configurar VPN para usuarios remotos','14. Configurar reglas de filtrado por IP','15. Configurar reglas de filtrado por servicio','16. Configurar geobloqueo si aplica','17. Habilitar logging de tráfico','18. Configurar alertas de seguridad por correo','19. Configurar sincronización de hora (NTP)','20. Actualizar firmware del firewall','21. Realizar pruebas de conectividad','22. Verificar que las reglas funcionan correctamente','23. Documentar todas las reglas configuradas','24. Programar revisión periódica de reglas','25. Entregar documentación a gerencia de IT'] },
    { id: 'emp-servidor-fisico', icon: '🖥️', title: 'Instalación de Servidor Físico', children: ['1. Verificar especificaciones del servidor recibido','2. Verificar rack y espacio disponible','3. Verificar alimentación eléctrica y UPS','4. Montar servidor en rack con rieles','5. Conectar cables de alimentación redundante','6. Conectar cables de red (al menos 2 NICs)','7. Conectar cable de gestión (iLO/iDRAC)','8. Encender servidor y acceder a BIOS/UEFI','9. Configurar fecha y hora en BIOS','10. Configurar orden de arranque','11. Habilitar virtualización (VT-x/AMD-V)','12. Verificar discos físicos detectados','13. Configurar RAID (nivel según requisito)','14. Inicializar discos y crear volumen lógico','15. Insertar medio de instalación (USB/DVD)','16. Iniciar instalación del S.O. servidor','17. Seleccionar partición e instalar','18. Configurar idioma y región','19. Asignar nombre del servidor','20. Asignar IP estática, máscara y gateway','21. Configurar DNS primario y secundario','22. Crear contraseña de administrador','23. Completar instalación y reiniciar','24. Instalar drivers del fabricante','25. Ejecutar Windows Update hasta estar al día','26. Instalar herramientas de gestión del fabricante','27. Configurar iLO/iDRAC con IP de gestión','28. Verificar estado de hardware en consola','29. Documentar configuración del servidor','30. Entregar servidor listo para uso'] },
    { id: 'emp-servidor-virtual', icon: '📦', title: 'Instalación de Servidor Virtual', children: ['1. Verificar requisitos de la VM (CPU, RAM, disco)','2. Acceder al hipervisor (Hyper-V/VMware)','3. Verificar almacenamiento disponible en datastore','4. Crear nueva máquina virtual','5. Asignar nombre descriptivo a la VM','6. Asignar vCPU según requisito','7. Asignar memoria RAM según requisito','8. Crear disco virtual (thin/thick provisioning)','9. Asignar tamaño de disco','10. Configurar controlador de disco (SCSI/SATA)','11. Configurar adaptador de red virtual','12. Conectar ISO de instalación','13. Configurar orden de arranque de la VM','14. Iniciar la VM','15. Acceder por consola del hipervisor','16. Iniciar instalación del S.O.','17. Configurar idioma y región','18. Asignar nombre del servidor','19. Asignar IP estática','20. Configurar DNS y gateway','21. Crear contraseña de administrador','22. Completar instalación y reiniciar','23. Instalar VMware Tools / Hyper-V Integration Services','24. Ejecutar Windows Update hasta estar al día','25. Instalar software y roles necesarios','26. Configurar reglas de firewall del S.O.','27. Tomar snapshot inicial','28. Verificar conectividad de red','29. Documentar configuración de la VM','30. Entregar VM lista para uso'] },
    { id: 'emp-servidor-web', icon: '🌍', title: 'Instalación de Servidor Web', children: ['1. Verificar requisitos del servidor web','2. Instalar S.O. servidor (Windows/Linux)','3. Asignar IP estática al servidor','4. Configurar DNS para resolver el dominio','5. Instalar rol IIS (Windows) o Apache/Nginx (Linux)','6. Verificar instalación del servicio web','7. Configurar sitio web predeterminado','8. Crear carpeta raíz del sitio web','9. Configurar bindings (HTTP puerto 80)','10. Desplegar archivos del sitio web','11. Configurar documento predeterminado (index.html, default.aspx)','12. Configurar permisos de carpeta (IIS_IUSRS/www-data)','13. Probar acceso local al sitio','14. Instalar certificado SSL/TLS','15. Configurar bindings HTTPS (puerto 443)','16. Redirigir HTTP a HTTPS','17. Configurar cabeceras de seguridad','18. Configurar compresión (gzip)','19. Configurar caching de contenido estático','20. Configurar logging del sitio web','21. Configurar rotación de logs','22. Abrir puertos 80 y 443 en firewall','23. Configurar reglas de WAF si aplica','24. Probar acceso externo al sitio','25. Verificar certificado SSL con SSL Labs','26. Configurar backup del sitio web','27. Documentar configuración del servidor web','28. Entregar servidor web en producción'] },
    { id: 'emp-servidor-archivos', icon: '📁', title: 'Servidor de Archivos', children: ['1. Instalar S.O. servidor','2. Instalar rol de File and Storage Services','3. Configurar discos y volúmenes','4. Crear estructura de carpetas por departamento','5. Crear grupos de seguridad en AD por departamento','6. Configurar permisos NTFS por carpeta','7. Configurar cuotas de disco si aplica','8. Habilitar Access-Based Enumeration (ABE)','9. Configurar recurso compartido (SMB/CIFS)','10. Configurar permisos de recurso compartido','11. Configurar shadow copies (VSS)','12. Programar shadow copies cada 12 horas','13. Configurar DFS si hay múltiples sitios','14. Configurar replicación DFS entre sitios','15. Mapear unidades por GPO a usuarios','16. Probar acceso a carpetas compartidas','17. Verificar permisos por departamento','18. Configurar auditoría de accesos','19. Configurar antivirus excluyendo carpetas de servidor','20. Programar defragmentación si HDD','21. Configurar backup de carpetas compartidas','22. Documentar estructura de carpetas y permisos','23. Entregar servidor de archivos en producción'] },
    { id: 'emp-servidor-correo', icon: '📧', title: 'Servidor de Correo', children: ['1. Verificar requisitos del servidor de correo','2. Instalar S.O. servidor','3. Instalar rol Exchange Server o hMailServer','4. Configurar dominio de correo aceptado','5. Crear bases de datos de buzones','6. Configurar conectores de recepción (SMTP)','7. Configurar conectores de envío (SMTP)','8. Configurar certificado digital (SSL/TLS)','9. Configurar DNS público (MX, SPF, DKIM, DMARC)','10. Crear buzones de usuario','11. Configurar límites de tamaño de buzón','12. Configurar límites de tamaño de mensaje','13. Configurar política de retención de correos','14. Configurar anti-spam','15. Configurar antivirus de correo','16. Configurar OWA (Outlook Web Access)','17. Configurar ActiveSync para móviles','18. Configurar auto-discover','19. Probar envío de correo interno','20. Probar envío y recepción externa','21. Verificar que el correo no llega a spam','22. Configurar backup de buzones','23. Configurar journaling si aplica','24. Documentar configuración del servidor','25. Entregar servidor de correo en producción'] },
    { id: 'emp-ad', icon: '🏛️', title: 'Configuración de Active Directory', children: ['1. Verificar requisitos de dominio','2. Asignar IP estática al servidor','3. Configurar DNS en el servidor','4. Instalar rol de Active Directory Domain Services','5. Promover servidor a controlador de dominio','6. Crear nuevo bosque o unirse a existente','7. Asignar nombre de dominio (ej: empresa.local)','8. Configurar nivel funcional del bosque','9. Configurar nivel funcional del dominio','10. Verificar creación de bases de datos NTDS','11. Verificar replicación de DNS','12. Crear estructura de OUs por departamento','13. Crear grupos de seguridad globales','14. Crear grupos de distribución','15. Crear cuentas de servicio','16. Configurar política de contraseñas','17. Configurar política de bloqueo de cuentas','18. Delegar administración en OUs si aplica','19. Instalar segundo DC para redundancia','20. Verificar replicación entre DCs','21. Configurar sitios y subredes de AD','22. Configurar vínculos de sitio','23. Configurar NTP en el DC (PDC emulator)','24. Documentar estructura de AD','25. Entregar AD operativo'] },
    { id: 'emp-dns-dhcp', icon: '🌐', title: 'Configuración de DNS/DHCP', children: ['1. Instalar rol DNS Server','2. Crear zona primaria directa (forward lookup)','3. Crear zona primaria inversa (reverse lookup)','4. Configurar registros A para servidores','5. Configurar registros CNAME si aplica','6. Configurar registros MX para correo','7. Configurar registros SRV para servicios','8. Configurar reenviadores (forwarders) DNS','9. Configurar scavenging de DNS','10. Verificar resolución de nombres interna','11. Verificar resolución de nombres externa','12. Instalar rol DHCP Server','13. Autorizar DHCP en AD','14. Crear ámbito (scope) DHCP por subred','15. Definir rango de IPs excluyendo reservas','16. Configurar máscara de subred','17. Configurar gateway predeterminado','18. Configurar servidores DNS en ámbito','19. Configurar lease time','20. Crear reservas de IP por MAC','21. Configurar opciones de DHCP adicionales','22. Verificar asignación de IPs a clientes','23. Configurar conflicto de direcciones','24. Documentar configuración DNS/DHCP','25. Entregar servicio operativo'] },
    { id: 'emp-base-datos', icon: '🗄️', title: 'Instalación de Base de Datos', children: ['1. Verificar requisitos de hardware para BD','2. Verificar S.O. compatible con versión de BD','3. Instalar prerequisitos (.NET, etc.)','4. Descargar instalador del motor de BD (SQL Server/MySQL/PostgreSQL)','5. Ejecutar instalador del motor de BD','6. Seleccionar tipo de instalación (nueva)','7. Aceptar términos de licencia','8. Seleccionar características a instalar (motor, SSMS, herramientas)','9. Configurar instancia (predeterminada o nombrada)','10. Configurar cuenta de servicio del motor','11. Configurar tipo de autenticación (Windows/Mixta)','12. Asignar contraseña de sa/admin','13. Configurar collation y idioma','14. Configurar ubicación de archivos de datos','15. Configurar ubicación de archivos de log','16. Configurar ubicación de tempdb','17. Completar instalación','18. Verificar servicio de BD iniciado','19. Instalar SQL Server Management Studio / pgAdmin','20. Conectar al motor de BD','21. Configurar memoria máxima del motor','22. Configurar max degree of parallelism','23. Configurar backup automático (full, differential, log)','24. Configurar mantenimiento de índices y estadísticas','25. Abrir puerto en firewall (1433/3306/5432)','26. Crear base de datos de aplicación','27. Crear usuarios y roles de BD','28. Documentar configuración de BD','29. Entregar BD lista para aplicación'] },
    { id: 'emp-gpo', icon: '⚙️', title: 'Configuración de GPO', children: ['1. Abrir Group Policy Management Console','2. Crear nueva GPO con nombre descriptivo','3. Vincular GPO a OU correspondiente','4. Configurar políticas de contraseñas (complejidad, longitud, duración)','5. Configurar política de bloqueo de cuentas','6. Configurar mapeo de unidades de red','7. Configurar impresoras desplegadas','8. Configurar scripts de inicio de sesión','9. Configurar fondo de pantalla corporativo','10. Configurar bloqueo de panel de control','11. Configurar restricciones de software','12. Configurar Windows Update por GPO','13. Configurar firewall de Windows por GPO','14. Configurar políticas de seguridad local','15. Configurar delegación de administración','16. Configurar AppLocker si aplica','17. Configurar redirección de carpetas','18. Configurar perfiles móviles si aplica','19. Configurar tiempo de espera de pantalla','20. Configurar políticas de Edge/Chrome','21. Probar GPO en OU de pruebas','22. Verificar aplicación con gpresult','23. Ajustar filtros WMI si aplica','24. Documentar GPOs configuradas','25. Entregar GPOs en producción'] },
    { id: 'emp-red-mantenimiento', icon: '🔧', title: 'Mantenimiento de Red', children: ['1. Acceder a consola de gestión de switches','2. Verificar estado de puertos (up/down)','3. Verificar utilización de CPU y memoria','4. Revisar logs de eventos de red','5. Verificar configuración de VLANs','6. Verificar trunking entre switches','7. Revisar cableado estructurado visualmente','8. Verificar etiquetado de cables','9. Probar conectividad entre VLANs (ping)','10. Probar conectividad entre sitios (ping/tracert)','11. Analizar tráfico con Wireshark si hay problemas','12. Verificar ancho de banda utilizado','13. Configurar QoS si hay congestión','14. Actualizar firmware de switches','15. Actualizar firmware de routers','16. Verificar enlaces WAN','17. Verificar redundancia de enlaces','18. Revisar ACLs de routers','19. Detectar dispositivos no autorizados en red','20. Optimizar rutas estáticas y dinámicas','21. Verificar Spanning Tree Protocol','22. Generar reporte de estado de red','23. Documentar topología actualizada','24. Programar próximo mantenimiento'] },
    { id: 'emp-vpn', icon: '🔗', title: 'Configuración de VPN', children: ['1. Verificar requisitos de acceso remoto','2. Seleccionar tipo de VPN (site-to-site o cliente)','3. Verificar licencias del equipo de firewall/router','4. Acceder al firewall/router','5. Habilitar servicio VPN','6. Configurar pool de IPs para clientes VPN','7. Configurar DNS e IP del pool','8. Crear usuarios VPN','9. Asignar contraseñas seguras','10. Crear certificados digitales si aplica','11. Configurar protocolo (IPSec, L2TP, OpenVPN, SSL)','12. Configurar cifrado y algoritmos','13. Configurar autenticación (local o RADIUS/AD)','14. Configurar MFA para VPN','15. Configurar split tunneling','16. Configurar rutas accesibles por VPN','17. Configurar tiempo máximo de conexión','18. Configurar keepalive','19. Abrir puertos necesarios en firewall','20. Instalar cliente VPN en equipo de usuario','21. Configurar cliente VPN con datos de conexión','22. Probar conexión VPN desde equipo remoto','23. Verificar acceso a recursos internos','24. Verificar velocidad and latencia','25. Configurar logging de conexiones VPN','26. Documentar configuración de VPN','27. Entregar acceso VPN operativo'] },
    { id: 'emp-backups-config', icon: '💾', title: 'Configuración de Backups', children: ['1. Identificar datos críticos a respaldar','2. Identificar servidores y bases de datos a respaldar','3. Seleccionar software de backup (Veeam, Commvault, etc.)','4. Instalar servidor de backup','5. Configurar repositorio de backup (disco/NAS/cinta)','6. Agregar servidores al console de backup','7. Crear job de backup de servidores virtuales','8. Crear job de backup de servidores físicos','9. Crear job de backup de bases de datos (SQL/Exchange)','10. Configurar tipo de backup (full, incremental, diferencial)','11. Configurar schedule full semanal','12. Configurar schedule incremental diario','13. Configurar política de retención (GFS)','14. Configurar cifrado de backups','15. Configurar compresión de backups','16. Configurar replicación offsite si aplica','17. Configurar notificaciones por correo (éxito/fallo)','18. Ejecutar primer backup completo','19. Verificar integridad del backup','20. Realizar prueba de restauración completa','21. Verificar tiempo de restauración','22. Configurar backup de configuración de equipos de red','23. Configurar backup de Office 365 si aplica','24. Documentar procedimiento de backup','25. Documentar procedimiento de restauración','26. Entregar sistema de backup operativo'] },
    { id: 'emp-backups-monitoreo', icon: '📊', title: 'Monitoreo de Backups', children: ['1. Verificar logs de ejecución de backup diario','2. Verificar logs de ejecución de backup semanal','3. Revisar alertas de fallos por correo','4. Identificar jobs fallidos','5. Investigar causa de fallo','6. Corregir problema y reejecutar job','7. Verificar tamaño de backups','8. Verificar tiempo de ejecución de backups','9. Verificar almacenamiento utilizado en repositorio','10. Verificar espacio libre en repositorio','11. Realizar prueba de restauración mensual','12. Restaurar archivo aleatorio para verificar','13. Restaurar VM aleatoria para verificar','14. Verificar replicación offsite','15. Verificar integridad de backups replicados','16. Limpiar backups expirados según retención','17. Generar reporte mensual de cumplimiento','18. Verificar cumplimiento de SLA de backup','19. Optimizar tiempos de backup si es necesario','20. Auditar retención de datos','21. Verificar cifrado de backups','22. Documentar incidencias y resoluciones','23. Entregar reporte mensual a gerencia de IT'] },
    { id: 'emp-erp', icon: '📋', title: 'Instalación de ERP/CRM', children: ['1. Levantar requisitos del ERP/CRM con el proveedor','2. Verificar compatibilidad con S.O. y base de datos','3. Preparar servidor de aplicación','4. Preparar servidor de base de datos','5. Instalar motor de base de datos (SQL Server)','6. Crear base de datos para el ERP/CRM','7. Configurar collation y idioma de BD','8. Crear usuario de BD para la aplicación','9. Asignar permisos al usuario de BD','10. Instalar prerequisitos del ERP/CRM (.NET, IIS, etc.)','11. Ejecutar instalador del ERP/CRM','12. Configurar cadena de conexión a BD','13. Crear esquema de base de datos','14. Cargar datos iniciales/demo','15. Configurar módulos a utilizar','16. Configurar parámetros de la empresa','17. Configurar plan de cuentas si aplica','18. Configurar centros de costo','19. Configurar bodegas/sucursales','20. Crear usuarios del sistema','21. Asignar roles y permisos a usuarios','22. Migrar datos históricos si aplica','23. Verificar integridad de migración','24. Configurar integraciones con otros sistemas','25. Realizar pruebas de funcionamiento por módulo','26. Realizar pruebas de integridad de datos','27. Capacitar a usuarios finales','28. Capacitar a administradores del sistema','29. Configurar backup del ERP/CRM','30. Documentar configuración del sistema','31. Entregar sistema en producción'] },
    { id: 'emp-software-mantenimiento', icon: '⚙️', title: 'Mantenimiento de Software', children: ['1. Recibir reporte de incidencia o tarea programada','2. Clasificar prioridad de la incidencia','3. Acceder al servidor de aplicación','4. Revisar logs de aplicación','5. Revisar logs de eventos de Windows','6. Identificar causa raíz del problema','7. Verificar estado de servicios de la aplicación','8. Reiniciar servicio si es necesario','9. Verificar conectividad a base de datos','10. Verificar espacio en disco del servidor','11. Verificar memoria disponible del servidor','12. Verificar CPU del servidor','13. Instalar parche de seguridad si aplica','14. Actualizar versión de software si aplica','15. Optimizar consultas de base de datos','16. Rebuild de índices de BD','17. Update de estadísticas de BD','18. Limpiar archivos temporales','19. Limpiar logs antiguos','20. Verificar configuración de IIS/Apache','21. Reciclar pool de aplicación si aplica','22. Verificar certificados SSL','23. Probar funcionamiento post-cambio','24. Documentar incidencia y solución','25. Cerrar ticket de soporte','26. Programar seguimiento si aplica'] },
    { id: 'emp-print-server', icon: '🖨️', title: 'Servidor de Impresión', children: ['1. Instalar rol Print and Document Services','2. Abrir Print Management Console','3. Agregar impresora (TCP/IP o local)','4. Seleccionar puerto TCP/IP con IP de impresora','5. Instalar driver de impresora (x64)','6. Instalar driver de impresora (x86) si aplica','7. Asignar nombre descriptivo a impresora','8. Compartir impresora con nombre de recurso','9. Configurar ubicación y comentarios','10. Configurar permisos de impresión por grupo','11. Configurar cuotas de impresión si aplica','12. Probar impresión de prueba','13. Desplegar impresora por GPO','14. Mapear impresora por grupo de seguridad','15. Configurar impresora por defecto por GPO','16. Configurar pooling de impresoras si aplica','17. Habilitar logging de impresión','18. Auditar uso de impresoras','19. Solucionar problemas de cola de impresión','20. Limpiar colas atascadas','21. Reiniciar servicio Print Spooler si es necesario','22. Actualizar drivers de impresoras','23. Documentar impresoras configuradas','24. Entregar servidor de impresión operativo'] },
    { id: 'emp-impresoras', icon: '🖨️', title: 'Mantenimiento de Impresoras', children: ['1. Monitorear niveles de tóner/tinta en consola','2. Generar reporte de niveles bajos','3. Solicitar compra de consumibles','4. Reemplazar tóner/cartuchos con niveles bajos','5. Configurar alertas por correo para niveles bajos','6. Realizar mantenimiento preventivo mensual','7. Limpiar rodillos de alimentación','8. Limpiar bandejas de papel','9. Limpiar exterior de impresora','10. Calibrar impresora','11. Alinear cabezales de impresión','12. Verificar calidad de impresión','13. Actualizar firmware de impresora','14. Reemplazar fusor según ciclo de vida','15. Reemplazar rodillos según ciclo de vida','16. Verificar conectividad de red','17. Verificar configuración de IP','18. Solucionar atascos de papel','19. Generar reporte de uso por departamento','20. Generar reporte de costos de impresión','21. Documentar mantenimientos realizados','22. Programar próximo mantenimiento preventivo'] },
    { id: 'emp-seguridad-audit', icon: '🔍', title: 'Auditoría de Seguridad', children: ['1. Definir alcance de la auditoría','2. Obtener autorización formal','3. Instalar herramienta de escaneo de vulnerabilidades','4. Ejecutar escaneo de vulnerabilidades en servidores','5. Ejecutar escaneo de vulnerabilidades en estaciones','6. Ejecutar escaneo de vulnerabilidades en red','7. Analizar resultados del escaneo','8. Clasificar vulnerabilidades por severidad','9. Revisar políticas de contraseñas','10. Verificar complejidad de contraseñas','11. Auditar permisos de archivos compartidos','12. Auditar permisos de AD (usuarios con privilegios excesivos)','13. Auditar miembros de grupos de administradores','14. Revisar logs de acceso a sistemas críticos','15. Analizar puertos abiertos en servidores','16. Analizar puertos abiertos en firewall','17. Revisar configuración de firewall','18. Revisar reglas de VPN activas','19. Verificar cifrado de datos en tránsito','20. Verificar cifrado de datos en reposo','21. Revisar políticas de GPO de seguridad','22. Realizar pruebas de penetración básicas','23. Compilar reporte de hallazgos','24. Crear plan de remediación priorizado','25. Presentar reporte a gerencia de IT','26. Dar seguimiento a remediación'] },
    { id: 'emp-seguridad-perimetral', icon: '🚨', title: 'Seguridad Perimetral', children: ['1. Revisar topología de seguridad perimetral','2. Verificar configuración de firewall perimetral','3. Revisar reglas de entrada (inbound)','4. Eliminar reglas obsoletas o innecesarias','5. Verificar configuración de DMZ','6. Revisar servicios expuestos a internet','7. Verificar que solo puertos necesarios estén abiertos','8. Configurar/verificar IDS/IPS','9. Actualizar firmas de IDS/IPS','10. Analizar tráfico de red en perímetro','11. Detectar tráfico anómalo','12. Bloquear IPs maliciosas identificadas','13. Configurar geobloqueo si aplica','14. Revisar logs de seguridad del firewall','15. Monitorear intentos de acceso fallidos','16. Verificar configuración de VPN','17. Revisar VPNs activas y usuarios conectados','18. Auditar certificados de VPN','19. Configurar honeypot si aplica','20. Realizar pruebas de penetración externas','21. Generar reporte de eventos de seguridad','22. Documentar incidentes detectados','23. Programar revisión periódica mensual'] },
    { id: 'emp-virtualizacion', icon: '🖥️', title: 'Virtualización', children: ['1. Verificar requisitos de hardware del host','2. Verificar soporte de virtualización en BIOS (VT-x/AMD-V)','3. Instalar hipervisor (Hyper-V/VMware ESXi)','4. Configurar red del hipervisor (vSwitch)','5. Configurar almacenamiento (datastore)','6. Crear vSwitch para red de gestión','7. Crear vSwitch para red de producción','8. Crear vSwitch para red de storage (iSCSI/NFS)','9. Configurar NIC teaming si aplica','10. Crear primera VM (plantilla)','11. Instalar S.O. en plantilla','12. Instalar VMware Tools/Integration Services','13. Sysprep la plantilla','14. Clonar VMs desde plantilla según necesidad','15. Configurar recursos de cada VM (CPU, RAM, disco)','16. Configurar red de cada VM','17. Instalar aplicaciones en cada VM','18. Configurar snapshots programados','19. Configurar backup de VMs','20. Configurar alta disponibilidad (HA) si hay cluster','21. Configurar Distributed Resource Scheduler (DRS)','22. Configurar vMotion/Live Migration','23. Monitorear recursos del host (CPU, RAM, storage)','24. Monitorear recursos de cada VM','25. Optimizar almacenamiento (thin provisioning)','26. Migrar VMs entre hosts si es necesario','27. Documentar entorno virtual completo','28. Entregar entorno virtual operativo'] },
    { id: 'emp-cloud', icon: '☁️', title: 'Migración a Nube', children: ['1. Evaluar cargas de trabajo candidatas a migrar','2. Seleccionar proveedor (Azure/AWS/GCP)','3. Crear cuenta y suscripción en la nube','4. Configurar MFA para cuenta de nube','5. Configurar red virtual (VNet/VPC)','6. Configurar subredes','7. Configurar grupos de seguridad (NSG/SG)','8. Configurar VPN site-to-site con oficina','9. Configurar ExpressRoute/Direct Connect si aplica','10. Configurar identidad híbrida (Azure AD Connect)','11. Sincronizar AD local con Azure AD','12. Migrar servidores con herramienta de migración','13. Migrar bases de datos a la nube','14. Migrar archivos a almacenamiento en nube','15. Configurar backups en la nube','16. Configurar monitoreo de recursos en nube','17. Configurar alertas de costos','18. Optimizar costos (reserved instances, auto-scaling)','19. Configurar políticas de seguridad en la nube','20. Verificar cumplimiento normativo','21. Probar conectividad entre nube y oficina','22. Probar acceso a aplicaciones migradas','23. Configurar recuperación ante desastres','24. Documentar arquitectura en la nube','25. Capacitar a administradores','26. Entregar entorno en nube operativo'] },
    { id: 'emp-hw-mantenimiento', icon: '🛠️', title: 'Mantenimiento de Hardware', children: ['1. Programar ventana de mantenimiento','2. Notificar a usuarios del tiempo de interrupción','3. Acceder físicamente al rack/datacenter','4. Inspección visual de servidores y equipos','5. Verificar luces de estado de cada servidor','6. Limpieza física interna de servidores','7. Limpieza de ventiladores y filtros','8. Limpieza de switches y routers','9. Cambio de pasta térmica en servidores si aplica','10. Verificar fuentes de poder redundantes','11. Reemplazar fuente fallida si aplica','12. Verificar discos RAID y estado SMART','13. Reemplazar discos fallidos o degradados','14. Verificar reconstrucción de RAID','15. Revisión de temperatura y ventilación','16. Verificar aire acondicionado del datacenter','17. Revisión de UPS y estado de baterías','18. Reemplazar baterías de UPS si aplica','19. Revisión de cableado de rack','20. Organizar y etiquetar cables','21. Reemplazar cables dañados','22. Verificar alimentación eléctrica','23. Generar reporte de estado de hardware','24. Documentar componentes reemplazados','25. Cerrar ventana de mantenimiento'] },
    { id: 'emp-soporte', icon: '🎧', title: 'Soporte Técnico', children: ['1. Recibir ticket de soporte','2. Clasificar prioridad y categoría','3. Contactar al usuario afectado','4. Recopilar información del problema','5. Reproducir el problema si es posible','6. Diagnosticar causa del problema','7. Buscar solución en base de conocimiento','8. Acceso remoto al equipo si es necesario','9. Aplicar solución al problema','10. Instalar software bajo demanda','11. Configurar periféricos','12. Resolver problemas de correo','13. Resolver problemas de red','14. Resolver problemas de impresión','15. Resolver problemas de aplicaciones','16. Escalar a nivel 2/3 si es necesario','17. Verificar que el problema está resuelto','18. Confirmar con el usuario','19. Documentar solución aplicada','20. Actualizar base de conocimiento','21. Cerrar ticket de soporte','22. Seguimiento post-solución'] },
    { id: 'emp-documentacion', icon: '📝', title: 'Documentación de IT', children: ['1. Crear plantilla de documentación','2. Documentar topología de red actualizada','3. Crear diagrama de red visual','4. Documentar arquitectura de servidores','5. Documentar configuración de cada servidor','6. Documentar configuración de firewall','7. Documentar configuración de switches','8. Documentar configuración de routers','9. Documentar configuración de VPN','10. Documentar procedimientos de backup','11. Documentar procedimientos de restauración','12. Documentar políticas de seguridad','13. Documentar políticas de contraseñas','14. Documentar matriz de responsabilidades IT','15. Documentar inventario de software y licencias','16. Documentar contratos con proveedores','17. Documentar manuales de usuario','18. Documentar procedimientos operativos','19. Documentar plan de recuperación ante desastres','20. Documentar contactos de emergencia','21. Revisar y actualizar documentación existente','22. Almacenar documentación en lugar accesible','23. Entregar documentación a gerencia de IT'] }
  ],
  residencial: [
    { id: 'res-hardware-diag', icon: '🔍', title: 'Diagnóstico de Hardware', children: ['1. Recibir equipo del cliente','2. Entrevistar al cliente sobre el problema','3. Documentar síntomas reportados','4. Inspección visual externa del equipo','5. Verificar daño físico evidente','6. Conectar equipo a corriente','7. Intentar encender el equipo','8. Verificar si hay post beep códigos','9. Verificar si hay luces de diagnóstico','10. Inspección visual interna (abrir chasis)','11. Verificar conexiones internas','12. Verificar que la RAM esté bien conectada','13. Verificar que la tarjeta gráfica esté bien conectada','14. Verificar conexiones de disco','15. Verificar conexiones de fuente de poder','16. Probar periféricos (teclado, mouse, monitor)','17. Ejecutar test de memoria RAM (MemTest86)','18. Ejecutar diagnóstico de disco (SMART/CrystalDisk)','19. Ejecutar test de fuente de poder','20. Medir temperatura de CPU y GPU','21. Ejecutar test de estabilidad del sistema','22. Probar puertos USB','23. Probar puertos de audio','24. Probar puertos de red','25. Compilar resultados del diagnóstico','26. Generar reporte para el cliente','27. Recomendar reparación o reemplazo','28. Cotizar repuestos si aplica'] },
    { id: 'res-hardware-limpieza', icon: '🧹', title: 'Limpieza de Equipo', children: ['1. Apagar el equipo correctamente','2. Desconectar todos los cables','3. Mover equipo a área de trabajo','4. Usar pulsera antiestática','5. Abrir el chasis (quitar paneles laterales)','6. Fotografiar interior antes de manipular','7. Desconectar ventiladores para limpieza','8. Limpiar polvo con aire comprimido','9. Limpiar ventiladores con brocha suave','10. Limpiar disipador de CPU','11. Retirar disipador de CPU','12. Limpiar pasta térmica antigua con alcohol isopropílico','13. Aplicar pasta térmica nueva','14. Reinstalar disipador de CPU','15. Limpiar ventilador de fuente de poder','16. Limpiar interior de fuente de poder con aire','17. Limpiar puertos USB y conectores','18. Limpiar ranuras RAM con aire comprimido','19. Limpiar ranuras PCIe con aire comprimido','20. Limpiar pantalla con paño microfibra','21. Limpiar teclado con aire y paño','22. Limpiar mouse','23. Limpiar exterior del chasis','24. Revisar flujo de aire y cableado','25. Reensamblar el equipo','26. Conectar todos los cables','27. Encender y verificar funcionamiento','28. Verificar temperaturas post-limpieza','29. Entregar equipo al cliente'] },
    { id: 'res-hardware-reemplazo', icon: '🔧', title: 'Reemplazo de Componentes', children: ['1. Identificar componente defectuoso por diagnóstico','2. Informar al cliente sobre el componente dañado','3. Cotizar repuesto para el cliente','4. Aprobar cotización con el cliente','5. Adquirir repuesto compatible','6. Hacer backup de datos antes de intervención','7. Apagar y desconectar el equipo','8. Usar pulsera antiestática','9. Abrir el chasis','10. Desconectar cables del componente a reemplazar','11. Retirar componente defectuoso','12. Instalar componente nuevo','13. Conectar cables al componente nuevo','14. Verificar que todo esté bien conectado','15. Configurar BIOS/UEFI si aplica (RAM, disco, etc.)','16. Cerrar el chasis','17. Conectar cables externos','18. Encender el equipo','19. Verificar que el componente sea detectado','20. Instalar drivers del componente','21. Ejecutar pruebas de estabilidad','22. Ejecutar pruebas de rendimiento','23. Verificar temperatura del componente nuevo','24. Restaurar datos si se hizo backup','25. Probar funcionamiento completo','26. Entregar equipo al cliente','27. Explicar garantía de la reparación'] },
    { id: 'res-hardware-preventivo', icon: '⚙️', title: 'Mantenimiento Preventivo', children: ['1. Recibir equipo del cliente','2. Entrevistar al cliente sobre rendimiento','3. Hacer backup de datos importantes','4. Actualizar BIOS/UEFI a última versión','5. Actualizar firmware de dispositivos','6. Ejecutar diagnóstico de disco (SMART)','7. Ejecutar test de memoria RAM','8. Verificar temperatura de CPU','9. Verificar temperatura de GPU','10. Limpiar archivos temporales','11. Limpiar caché de sistema','12. Limpiar registro con CCleaner','13. Optimizar programas de inicio (msconfig)','14. Optimizar servicios de Windows innecesarios','15. Desfragmentar disco si es HDD','16. Verificar y actualizar drivers','17. Ejecutar Windows Update hasta estar al día','18. Actualizar software instalado','19. Limpiar navegador (caché, cookies, historial)','20. Eliminar barras de herramientas','21. Eliminar programas innecesarios','22. Limpiar física interna del equipo','23. Cambiar pasta térmica','24. Limpiar ventiladores','25. Verificar estado de disco (espacio libre)','26. Configurar plan de energía equilibrado','27. Ejecutar prueba de rendimiento post-optimización','28. Generar reporte de estado del equipo','29. Entregar equipo al cliente'] },
    { id: 'res-so-instalacion', icon: '💻', title: 'Instalación de S.O.', children: ['1. Hacer backup de datos del usuario','2. Exportar favoritos del navegador','3. Exportar contactos si aplica','4. Documentar software instalado','5. Crear medio de instalación (USB booteable)','6. Configurar BIOS para arrancar desde USB','7. Iniciar desde medio de instalación','8. Seleccionar idioma y región','9. Aceptar términos de licencia','10. Seleccionar tipo de instalación (personalizada)','11. Eliminar particiones existentes','12. Crear nuevas particiones si aplica','13. Formatear disco','14. Iniciar instalación del S.O.','15. Esperar a que se complete la instalación','16. Configurar cuenta de usuario','17. Asignar contraseña','18. Completar configuración inicial (OOBE)','19. Instalar drivers desde página del fabricante','20. Instalar drivers de chipset','21. Instalar drivers de video','22. Instalar drivers de audio','23. Instalar drivers de red (LAN/Wi-Fi)','24. Instalar drivers de periféricos','25. Ejecutar Windows Update hasta estar al día','26. Activar licencia de Windows','27. Instalar software base (antivirus, office, navegadores)','28. Instalar software específico del cliente','29. Restaurar datos del usuario','30. Configurar red y Wi-Fi','31. Configurar impresoras','32. Optimizar sistema post-instalación','33. Pruebas finales de funcionamiento','34. Entregar equipo al cliente'] },
    { id: 'res-so-software', icon: '📦', title: 'Instalación de Software', children: ['1. Recibir solicitud de software a instalar','2. Verificar compatibilidad con el equipo','3. Verificar requisitos mínimos (RAM, disco, CPU)','4. Descargar instalador desde sitio oficial','5. Verificar integridad del instalador','6. Desactivar antivirus temporalmente si es necesario','7. Ejecutar instalador como administrador','8. Aceptar términos de licencia','9. Seleccionar tipo de instalación (típica/personalizada)','10. Seleccionar ubicación de instalación','11. Desmarcar software adicional no deseado (bloatware)','12. Completar instalación','13. Activar licencia del software','14. Configurar software según preferencias del cliente','15. Crear accesos directos','16. Instalar antivirus si no está instalado','17. Instalar Office o suite ofimática','18. Instalar navegadores (Chrome, Firefox, Edge)','19. Instalar reproductores multimedia','20. Instalar herramientas de compresión (7-Zip, WinRAR)','21. Instalar software específico del cliente','22. Instalar drivers de periféricos','23. Configurar impresoras','24. Configurar correo electrónico','25. Ejecutar pruebas de funcionamiento de cada software','26. Reactivar antivirus','27. Documentar software instalado','28. Entregar equipo al cliente'] },
    { id: 'res-so-virus', icon: '🦠', title: 'Eliminación de Virus/Malware', children: ['1. Entrevistar al cliente sobre síntomas','2. Documentar comportamiento anómalo','3. Desconectar equipo de red (cable y Wi-Fi)','4. Reiniciar en modo seguro (F8 / Shift+Reiniciar)','5. Insertar USB con antivirus offline','6. Ejecutar antivirus offline (Kaspersky Rescue, Bitdefender)','7. Realizar escaneo completo del sistema','8. Identificar amenazas detectadas','9. Eliminar amenazas detectadas','10. Reiniciar en modo seguro nuevamente','11. Ejecutar Malwarebytes Anti-Malware','12. Realizar escaneo completo con Malwarebytes','13. Eliminar amenazas restantes','14. Restaurar archivos de sistema (sfc /scannow)','15. Reparar hosts file','16. Revisar y eliminar extensiones maliciosas del navegador','17. Restablecer configuración de navegadores','18. Eliminar barras de herramientas y adware','19. Revisar programas instalados recientemente','20. Desinstalar programas sospechosos','21. Revisar tareas programadas sospechosas','22. Revisar entradas de registro de malware','23. Limpiar registro con CCleaner','24. Restaurar configuración de red','25. Restaurar configuración de DNS','26. Reparar políticas de seguridad','27. Reiniciar en modo normal','28. Ejecutar escaneo final de verificación','29. Instalar/actualizar antivirus','30. Verificar que el sistema funcione correctamente','31. Entregar equipo al cliente','32. Recomendar prácticas de seguridad'] },
    { id: 'res-so-optimizacion', icon: '⚡', title: 'Optimización de Sistema', children: ['1. Recibir equipo del cliente','2. Entrevistar al cliente sobre lentitud percibida','3. Hacer backup de datos importantes','4. Verificar espacio libre en disco','5. Desinstalar programas innecesarios','6. Desinstalar bloatware del fabricante','7. Eliminar archivos temporales (Disk Cleanup)','8. Limpiar archivos temporales de usuario','9. Limpiar archivos temporales de sistema','10. Limpiar caché de Windows Update','11. Limpiar prefetch','12. Limpiar registro con CCleaner','13. Optimizar programas de inicio (msconfig/Task Manager)','14. Deshabilitar servicios innecesarios','15. Deshabilitar efectos visuales innecesarios','16. Configurar plan de energía de alto rendimiento','17. Desfragmentar disco si es HDD','18. Optimizar memoria virtual (pagefile)','19. Limpiar caché de navegadores','20. Eliminar cookies innecesarias','21. Eliminar barras de herramientas','22. Eliminar extensiones innecesarias del navegador','23. Actualizar drivers de video','24. Actualizar drivers de chipset','25. Ejecutar Windows Update','26. Verificar estado de disco (SMART)','27. Verificar temperatura de CPU','28. Ejecutar prueba de rendimiento post-optimización','29. Documentar cambios realizados','30. Entregar equipo al cliente'] },
    { id: 'res-red-config', icon: '🌐', title: 'Configuración de Red', children: ['1. Entrevistar al cliente sobre necesidades de red','2. Verificar conexión de internet activa','3. Conectar equipo por cable o Wi-Fi','4. Verificar adaptador de red detectado','5. Verificar drivers de adaptador de red','6. Configurar IP dinámica (DHCP) o estática según necesidad','7. Si IP estática: asignar IP, máscara y gateway','8. Configurar DNS primario y secundario','9. Probar conectividad con ping al gateway','10. Probar conectividad con ping a 8.8.8.8','11. Probar resolución de DNS con nslookup','12. Configurar Wi-Fi (SSID y contraseña)','13. Configurar Wi-Fi (cifrado WPA2/WPA3)','14. Configurar recursos compartidos si aplica','15. Mapear unidades de red si aplica','16. Configurar HomeGroup/Grupo Hogar si aplica','17. Solucionar conflictos de IP si los hay','18. Configurar firewall local de Windows','19. Probar velocidad de internet (Speedtest)','20. Probar estabilidad de conexión','21. Probar ping y latencia','22. Configurar QoS si aplica','23. Documentar configuración de red','24. Entregar equipo con red funcionando'] },
    { id: 'res-red-router', icon: '📡', title: 'Configuración de Router/Modem', children: ['1. Conectar router/modem a la corriente','2. Conectar cable de internet al WAN','3. Conectar equipo por cable al LAN','4. Abrir navegador y acceder a IP del router (192.168.1.1)','5. Iniciar sesión con credenciales por defecto','6. Cambiar contraseña de administrador','7. Configurar tipo de conexión WAN (PPPoE/Dinámica/Estática)','8. Si PPPoE: ingresar usuario y contraseña del ISP','9. Verificar conexión a internet','10. Configurar SSID de Wi-Fi (nombre de red)','11. Configurar contraseña de Wi-Fi','12. Configurar cifrado WPA2 o WPA3','13. Configurar banda 2.4GHz y 5GHz si aplica','14. Optimizar canal Wi-Fi menos congestionado','15. Configurar control parental si aplica','16. Configurar reserva de IP por MAC si aplica','17. Configurar apertura de puertos según necesidad','18. Configurar DMZ si aplica','19. Configurar DNS personalizado si aplica','20. Actualizar firmware del router','21. Configurar UPnP si aplica','22. Reiniciar router para aplicar cambios','23. Probar conexión Wi-Fi desde dispositivos','24. Probar conexión cableada','25. Probar velocidad de internet','26. Documentar configuración del router','27. Entregar router configurado al cliente'] },
    { id: 'res-red-problemas', icon: '🔌', title: 'Resolución de Problemas de Red', children: ['1. Entrevistar al cliente sobre el problema de red','2. Verificar si afecta a un equipo o todos','3. Verificar si es Wi-Fi o cable','4. Reiniciar modem/router (apagar 30 seg, encender)','5. Esperar a que sincronice el modem','6. Verificar luces del modem/router','7. Probar conectividad con ping al gateway','8. Probar conectividad con ping a 8.8.8.8','9. Probar resolución DNS con nslookup','10. Verificar cable de red físico','11. Reemplazar cable de red si está dañado','12. Probar con otro cable de red','13. Reset de adaptador de red (ipconfig /reset)','14. Renovar IP (ipconfig /renew)','15. Limpiar DNS cache (ipconfig /flushdns)','16. Reset de Winsock (netsh winsock reset)','17. Verificar drivers de adaptador de red','18. Actualizar drivers de adaptador de red','19. Deshabilitar y habilitar adaptador de red','20. Probar con conexión cableada si era Wi-Fi','21. Probar con otro dispositivo en la misma red','22. Verificar configuración de firewall local','23. Deshabilitar firewall temporalmente para descartar','24. Configurar nuevo adaptador Wi-Fi si está dañado','25. Probar conexión final','26. Documentar problema y solución','27. Recomendar mejoras de red si aplica','28. Entregar equipo con red funcionando'] },
    { id: 'res-movil-config', icon: '📱', title: 'Configuración Móvil', children: ['1. Encender dispositivo móvil','2. Completar configuración inicial (idioma, región)','3. Conectar a Wi-Fi','4. Iniciar sesión con cuenta Google (Android) o iCloud (iOS)','5. Crear cuenta si no tiene','6. Configurar fecha y hora automática','7. Configurar seguridad (PIN, patrón, biometría)','8. Configurar bloqueo automático de pantalla','9. Instalar apps esenciales (WhatsApp, correo, navegador)','10. Configurar cuenta de correo electrónico','11. Sincronizar contactos con cuenta','12. Configurar respaldo automático a la nube','13. Configurar notificaciones de apps','14. Configurar permisos de apps (ubicación, cámara, etc.)','15. Instalar antivirus móvil si es Android','16. Configurar Find My Device / Encontrar mi dispositivo','17. Configurar datos móviles si aplica','18. Configurar hotspot si aplica','19. Optimizar batería (brillo, background apps)','20. Limpiar apps innecesarias preinstaladas','21. Actualizar sistema operativo','22. Actualizar todas las apps instaladas','23. Configurar ringtone y sonidos','24. Probar funcionamiento de todas las funciones','25. Entregar dispositivo configurado al cliente'] },
    { id: 'res-movil-transferencia', icon: '📤', title: 'Transferencia de Datos', children: ['1. Recibir dispositivo origen y destino','2. Verificar que ambos dispositivos funcionen','3. Verificar espacio disponible en dispositivo destino','4. Conectar dispositivo origen a computadora','5. Hacer backup completo del dispositivo origen','6. Copiar fotos y videos a computadora','7. Copiar contactos (exportar vCard o a Google)','8. Copiar documentos y archivos','9. Copiar mensajes si aplica (con herramienta)','10. Desconectar dispositivo origen','11. Encender y configurar dispositivo destino','12. Conectar dispositivo destino a computadora','13. Transferir fotos y videos al dispositivo destino','14. Transferir contactos al dispositivo destino','15. Transferir documentos y archivos','16. Transferir mensajes si aplica','17. Migrar cuentas y contraseñas','18. Instalar apps en dispositivo destino','19. Configurar cuentas (Google, iCloud, correo)','20. Verificar integridad de datos transferidos','21. Verificar que fotos se vean correctamente','22. Verificar que contactos estén completos','23. Configurar apps en nuevo dispositivo','24. Realizar eliminación segura del dispositivo antiguo','25. Restaurar configuración de fábrica del antiguo','26. Entregar dispositivo nuevo al cliente','27. Entregar dispositivo antiguo limpio'] },
    { id: 'res-impresora-instalacion', icon: '🖨️', title: 'Instalación de Impresora', children: ['1. Desempaquetar impresora y verificar contenido','2. Retirar material de embalaje y cintas','3. Instalar cartuchos/tóner en la impresora','4. Cargar papel en la bandeja','5. Conectar cable de alimentación','6. Encender impresora','7. Configurar idioma y región en pantalla','8. Alinear cabezales si aplica','9. Imprimir página de configuración','10. Descargar drivers desde sitio oficial del fabricante','11. Ejecutar instalador de drivers','12. Seleccionar tipo de conexión (USB o red)','13. Si USB: conectar cable USB cuando se solicite','14. Si red: conectar cable de red o configurar Wi-Fi','15. Configurar IP de impresora si es red','16. Completar instalación de drivers','17. Configurar impresora como predeterminada','18. Ejecutar prueba de impresión','19. Verificar calidad de impresión','20. Instalar software de escaneo si aplica','21. Probar función de escáner','22. Configurar impresión móvil si aplica','23. Configurar impresión desde la nube si aplica','24. Documentar configuración de impresora','25. Entregar impresora funcionando al cliente'] },
    { id: 'res-impresora-mantenimiento', icon: '🛠️', title: 'Mantenimiento de Impresora', children: ['1. Encender impresora','2. Verificar niveles de tinta/tóner','3. Imprimir página de diagnóstico','4. Verificar calidad de impresión','5. Identificar problemas (rayas, manchas, colores desfasados)','6. Ejecutar limpieza de cabezales desde software','7. Ejecutar alineación de cartuchos','8. Ejecutar limpieza de boquillas','9. Limpiar rodillos de alimentación manualmente','10. Limpiar cristal del escáner con paño','11. Limpiar exterior de la impresora','12. Limpiar bandeja de papel','13. Reemplazar cartuchos/tóner si están vacíos','14. Reemplazar drum si aplica','15. Verificar que no hay atascos de papel','16. Eliminar atascos si los hay','17. Actualizar firmware de impresora','18. Verificar conectividad (USB o red)','19. Desbloquear cola de impresión si está atascada','20. Reiniciar servicio de cola de impresión en Windows','21. Probar impresión final','22. Probar escaneo si aplica','23. Recomendar consumibles al cliente','24. Documentar mantenimiento realizado','25. Entregar impresora funcionando al cliente'] },
    { id: 'res-camaras', icon: '📹', title: 'Instalación de Cámaras', children: ['1. Levantar ubicaciones de cámaras con el cliente','2. Verificar puntos de alimentación eléctrica','3. Verificar tendido de cable UTP posible','4. Instalar DVR/NVR en ubicación segura','5. Conectar DVR/NVR a monitor y red','6. Configurar disco duro en DVR/NVR','7. Formatear disco duro del DVR/NVR','8. Instalar soportes de cámaras en paredes/techo','9. Tendido de cable UTP desde cámara hasta DVR/NVR','10. Conectar cable de alimentación a cada cámara','11. Conectar cable UTP a cada cámara','12. Conectar cables UTP al DVR/NVR','13. Ajustar ángulos de visión de cada cámara','14. Encender DVR/NVR','15. Verificar que cada cámara muestra imagen','16. Configurar fecha y hora del DVR/NVR','17. Configurar resolución de cada cámara','18. Configurar programación de grabación','19. Configurar detección de movimiento','20. Configurar alertas por correo','21. Configurar notificaciones al celular','22. Configurar acceso remoto (DDNS/P2P)','23. Instalar app móvil en celular del cliente','24. Probar visualización remota desde celular','25. Probar grabación y reproducción','26. Probar visión nocturna','27. Probar alertas de movimiento','28. Entregar y capacitar al cliente','29. Documentar configuración de acceso remoto'] },
    { id: 'res-smart-home', icon: '🏠', title: 'Domótica / Smart Home', children: ['1. Verificar red Wi-Fi del hogar','2. Verificar cobertura Wi-Fi en todas las áreas','3. Configurar asistente virtual (Alexa/Google Home)','4. Conectar asistente a Wi-Fi','5. Crear cuenta y vincular dispositivos','6. Instalar bombillas inteligentes','7. Configurar bombillas en app','8. Instalar enchufes inteligentes','9. Configurar enchufes en app','10. Instalar termostato inteligente','11. Configurar termostato en app','12. Instalar cámaras Wi-Fi de interiores','13. Configurar cámaras en app','14. Instalar cerradura inteligente','15. Configurar cerradura en app','16. Instalar sensor de movimiento','17. Configurar sensor en app','18. Instalar timbre inteligente','19. Configurar timbre en app','20. Crear rutinas (ej: "Buenos días")','21. Crear automatizaciones (ej: encender luces al oscurecer)','22. Configurar escenas (ej: "Cine")','23. Agrupar dispositivos por habitación','24. Probar cada dispositivo individualmente','25. Probar rutinas y automatizaciones','26. Configurar acceso remoto','27. Capacitar al usuario','28. Documentar configuración'] },
    { id: 'res-soporte-remoto', icon: '🎧', title: 'Soporte Remoto', children: ['1. Recibir llamada o mensaje del cliente','2. Identificar el problema reportado','3. Enviar link de acceso remoto (AnyDesk, TeamViewer)','4. Esperar a que el cliente acepte la conexión','5. Acceder remotamente al equipo','6. Verificar problema reportado','7. Diagnosticar causa del problema','8. Aplicar solución al problema','9. Instalar software bajo demanda','10. Configurar periféricos remotamente','11. Resolver problemas de correo','12. Resolver problemas de red','13. Resolver problemas de impresión','14. Eliminar virus remotamente','15. Optimizar el sistema remotamente','16. Actualizar drivers','17. Configurar impresoras remotamente','18. Verificar que el problema está resuelto','19. Confirmar con el cliente','20. Desconectar sesión remota','21. Documentar problema y solución','22. Seguimiento post-solución'] },
    { id: 'res-backup', icon: '💾', title: 'Backup y Recuperación', children: ['1. Entrevistar al cliente sobre datos importantes','2. Identificar datos críticos a respaldar','3. Seleccionar destino de backup (disco externo, nube, USB)','4. Conectar disco externo si aplica','5. Verificar espacio disponible en destino','6. Copiar documentos a destino de backup','7. Copiar fotos a destino de backup','8. Copiar videos a destino de backup','9. Copiar música a destino de backup','10. Exportar favoritos del navegador','11. Exportar contactos','12. Exportar correos si aplica','13. Copiar configuraciones de software importante','14. Verificar integridad de archivos copiados','15. Configurar backup automático si aplica','16. Configurar historial de versiones si aplica','17. Probar restauración de un archivo','18. Documentar procedimiento de backup','19. Explicar al cliente cómo restaurar','20. Recomendar frecuencia de backup','21. Entregar datos respaldados al cliente'] },
    { id: 'res-recuperacion', icon: '♻️', title: 'Recuperación de Datos', children: ['1. Entrevistar al cliente sobre el problema','2. Determinar causa de pérdida de datos','3. Evaluar si el disco es accesible','4. Conectar disco a equipo de diagnóstico','5. Verificar si el disco es detectado por BIOS','6. Verificar estado SMART del disco','7. Si disco detectado: escanear con Recuva/TestDisk','8. Si disco no detectado: intentar recovery en otro puerto','9. Probar con adaptador USB a SATA','10. Si disco físico dañado: evaluar recuperación profesional','11. Escanear sectores del disco','12. Recuperar archivos eliminados','13. Recuperar particiones perdidas (TestDisk)','14. Recuperar archivos de partición formateada','15. Verificar integridad de archivos recuperados','16. Copiar archivos recuperados a disco seguro','17. Verificar que los archivos abran correctamente','18. Escanear archivos recuperados con antivirus','19. Generar reporte de archivos recuperados','20. Documentar procedimiento realizado','21. Recomendar backup al cliente','22. Entregar datos recuperados al cliente'] },
    { id: 'res-mac', icon: '🍎', title: 'Instalación/Configuración Mac', children: ['1. Recibir Mac del cliente','2. Verificar modelo y especificaciones','3. Hacer backup con Time Machine','4. Verificar espacio en disco','5. Crear medio de instalación macOS (USB booteable)','6. Reiniciar Mac en modo recuperación (Cmd+R)','7. Borrar disco con Disk Utility (APFS)','8. Reinstalar macOS desde recuperación','9. Esperar a que se complete la instalación','10. Configurar idioma y región','11. Configurar cuenta de Apple ID','12. Configurar iCloud','13. Restaurar datos desde Time Machine','14. Instalar aplicaciones desde App Store','15. Instalar aplicaciones desde sitio oficial','16. Configurar correo (Mail app)','17. Configurar calendario','18. Configurar Mensajes','19. Configurar FaceTime','20. Configurar impresora','21. Configurar red Wi-Fi','22. Actualizar macOS a última versión','23. Actualizar todas las apps instaladas','24. Configurar Find My Mac','25. Configurar Time Machine automático','26. Optimizar configuración de batería si es MacBook','27. Probar funcionamiento completo','28. Entregar Mac al cliente'] },
    { id: 'res-smart-tv', icon: '📺', title: 'Configuración de Smart TV', children: ['1. Instalar TV en soporte o mueble','2. Conectar TV a corriente','3. Conectar TV a red Wi-Fi o cable','4. Encender TV','5. Completar configuración inicial (idioma, país)','6. Configurar canales (TDT, cable, satélite)','7. Escanear canales automáticamente','8. Configurar cuenta de Samsung/LG/Android TV','9. Iniciar sesión en cuenta de streaming','10. Instalar apps (Netflix, YouTube, Prime, Disney+)','11. Configurar calidad de imagen','12. Configurar modo de imagen (cine, dinámico, etc.)','13. Configurar sonido','14. Configurar control parental','15. Configurar entrada HDMI (cable box, consola, etc.)','16. Configurar ARC/eARC si aplica','17. Configurar Bluetooth si aplica','18. Actualizar firmware del TV','19. Probar todas las apps instaladas','20. Probar casting/screen mirroring','21. Configurar asistente de voz si aplica','22. Capacitar al usuario','23. Documentar configuración'] }
  ]
};

const ICON_BG = {
  '🏢':'bg-emp','🚀':'bg-emp','🔄':'bg-emp','🔐':'bg-sec','👤':'bg-emp','🛡️':'bg-sec','🌐':'bg-net','🔧':'bg-hw','🌍':'bg-net','📁':'bg-emp','📧':'bg-emp','🏛️':'bg-emp','🗄️':'bg-emp','🚨':'bg-sec','🎧':'bg-emp','📝':'bg-emp','🍎':'bg-mob','♻️':'bg-bak','📺':'bg-mob','📋':'bg-sw','🖨️':'bg-prt',
  '🔗':'bg-net','💾':'bg-bak','📊':'bg-sw','⚙️':'bg-hw','🔍':'bg-hw','🧹':'bg-hw',
  '💻':'bg-sw','📦':'bg-sw','🦠':'bg-sec','⚡':'bg-sw','📡':'bg-net','📱':'bg-mob','📤':'bg-mob','🛠️':'bg-hw',
  '📹':'bg-net','🏠':'bg-mob','🖥️':'bg-emp','☁️':'bg-net','🔌':'bg-net'
};

const STORAGE_KEY = 'tareas_data_v2';
const CHECKS_KEY = 'tareas_checks_v2';

// ─── LÓGICA DE PERSISTENCIA Y INICIALIZACIÓN CON SUPABASE ─────
let isInitialized = false;
let checksCache = {};

function loadDataLocal() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.empresarial && parsed.residencial) return parsed;
    }
  } catch {}
  return JSON.parse(JSON.stringify(DEFAULT_DATA));
}

export let TAREAS_DATA = loadDataLocal();

export async function initTareasData() {
  if (isInitialized) return TAREAS_DATA;

  let localCache = loadDataLocal();
  try {
    const supabase = await getSupabase();
    const { data: catData, error: catError } = await supabase.from('tareas_data').select('*');
    if (!catError && catData) {
      if (catData.length === 0) {
        // La tabla está vacía en Supabase: sembrar datos iniciales
        const flattened = [];
        DEFAULT_DATA.empresarial.forEach(c => flattened.push({ id: c.id, icon: c.icon, title: c.title, type: 'empresarial', children: c.children }));
        DEFAULT_DATA.residencial.forEach(c => flattened.push({ id: c.id, icon: c.icon, title: c.title, type: 'residencial', children: c.children }));
        await supabase.from('tareas_data').insert(flattened);
        TAREAS_DATA = JSON.parse(JSON.stringify(DEFAULT_DATA));
      } else {
        // Mapear de base de datos a formato TAREAS_DATA
        const emps = catData.filter(c => c.type === 'empresarial').map(c => ({ id: c.id, icon: c.icon, title: c.title, children: c.children || [] }));
        const ress = catData.filter(c => c.type === 'residencial').map(c => ({ id: c.id, icon: c.icon, title: c.title, children: c.children || [] }));
        TAREAS_DATA = { empresarial: emps, residencial: ress };
      }
      isInitialized = true;
      try { localStorage.removeItem(STORAGE_KEY); } catch {}
    } else {
      TAREAS_DATA = localCache;
    }
  } catch (e) {
    TAREAS_DATA = localCache;
  }
  return TAREAS_DATA;
}

export async function loadChecks() {
  try {
    const supabase = await getSupabase();
    const { data, error } = await supabase.from('tareas_checks').select('id, checked');
    if (!error && data) {
      const map = {};
      data.forEach(item => {
        if (item.checked) map[item.id] = true;
      });
      checksCache = map;
      try { localStorage.removeItem(CHECKS_KEY); } catch {}
      return checksCache;
    }
  } catch (e) {}

  try {
    return JSON.parse(localStorage.getItem(CHECKS_KEY)) || {};
  } catch {
    return {};
  }
}

export async function saveChecks(checks) {
  try {
    const supabase = await getSupabase();
    
    // Guardar en cache local por si acaso
    localStorage.setItem(CHECKS_KEY, JSON.stringify(checks));

    const payload = Object.keys(checks).map(id => ({ id, checked: true }));
    if (payload.length > 0) {
      await supabase.from('tareas_checks').upsert(payload);
    }

    const oldChecks = checksCache || {};
    const removedIds = Object.keys(oldChecks).filter(id => !checks[id]);
    if (removedIds.length > 0) {
      await supabase.from('tareas_checks').delete().in('id', removedIds);
    }

    checksCache = { ...checks };
    try { localStorage.removeItem(CHECKS_KEY); } catch {}
  } catch (e) {
    localStorage.setItem(CHECKS_KEY, JSON.stringify(checks));
    toast('⚠️ Guardado localmente — sin conexión', 'warning');
  }
}

export async function saveData(data) {
  try {
    const supabase = await getSupabase();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));

    const rows = [];
    data.empresarial.forEach(c => rows.push({ id: c.id, icon: c.icon, title: c.title, type: 'empresarial', children: c.children }));
    data.residencial.forEach(c => rows.push({ id: c.id, icon: c.icon, title: c.title, type: 'residencial', children: c.children }));

    await supabase.from('tareas_data').upsert(rows);
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
  } catch (e) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    toast('⚠️ Guardado localmente — sin conexión', 'warning');
  }
}

export async function deleteCategory(id) {
  try {
    const supabase = await getSupabase();
    await supabase.from('tareas_data').delete().eq('id', id);
  } catch (e) {
    console.warn("Error al borrar categoría en la nube:", e);
  }
}

let expandedCards = new Set();

export async function tareasView() {
  const shell = ensureShell('/tareas');
  shell.setTitle(''); shell.setActions('');
  const c = shell.content();

  // Cargar datos más recientes
  await initTareasData();
  const checks = await loadChecks();

  const empSubtotal = TAREAS_DATA.empresarial.reduce((s, c) => s + c.children.length, 0);
  const resSubtotal = TAREAS_DATA.residencial.reduce((s, c) => s + c.children.length, 0);
  const totalCats = TAREAS_DATA.empresarial.length + TAREAS_DATA.residencial.length;
  const totalTasks = empSubtotal + resSubtotal;

  c.innerHTML = `
<div class="tasks-panel">
  <div class="tasks-header">
    <div class="tasks-header-title"><svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg> Lista de Tareas</div>
    <div class="tasks-header-badge">${totalCats} categorías · ${totalTasks} tareas</div>
  </div>

  <div class="tasks-toolbar">
    <input type="text" id="task-search" class="input" placeholder="Buscar tarea..." style="flex:1; min-width:200px;" />
    <button class="btn-secondary" id="btn-export" style="padding:8px 14px; border-radius:8px; font-size:12px; font-weight:700; white-space:nowrap;">📋 Exportar seleccionadas</button>
    <button class="btn-secondary" id="btn-reset" style="padding:8px 14px; border-radius:8px; font-size:12px; font-weight:700; white-space:nowrap;">↺ Restaurar</button>
  </div>

  <div class="tasks-category" id="cat-emp">
    <div class="tasks-category-header">
      <div class="tasks-category-icon"><svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1v1H9V7zm5 0h1v1h-1V7zm-5 4h1v1H9v-1zm5 0h1v1h-1v-1zm-5 4h1v1H9v-1zm5 0h1v1h-1v-1z"></path></svg></div>
      <div class="tasks-category-title">Empresarial</div>
      <div class="tasks-category-count">${TAREAS_DATA.empresarial.length} categorías · ${empSubtotal} tareas</div>
    </div>
    <div class="tasks-grid" id="grid-emp">
      ${TAREAS_DATA.empresarial.map(card => renderCard(card, 'empresarial', checks)).join('')}
    </div>
  </div>

  <div class="tasks-category" id="cat-res">
    <div class="tasks-category-header">
      <div class="tasks-category-icon"><svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"></path></svg></div>
      <div class="tasks-category-title">Residencial</div>
      <div class="tasks-category-count">${TAREAS_DATA.residencial.length} categorías · ${resSubtotal} tareas</div>
    </div>
    <div class="tasks-grid" id="grid-res">
      ${TAREAS_DATA.residencial.map(card => renderCard(card, 'residencial', checks)).join('')}
    </div>
  </div>

  <div class="tasks-footer">
    <button class="task-add-custom" id="btn-add-custom">
      <span>＋</span> <span>Agregar tarea personalizada</span>
    </button>
  </div>
</div>`;

  initCardInteractions();
  initToolbar();
}

function renderCard(card, prefix, checks = {}) {
  const bgClass = ICON_BG[card.icon] || 'bg-emp';
  const checkedCount = card.children.filter((_, idx) => checks[`${card.id}-${idx}`]).length;
  const progress = card.children.length > 0 ? Math.round((checkedCount / card.children.length) * 100) : 0;
  const isCustom = card.id.includes('-custom-');
  return `
<div class="task-row" data-id="${card.id}">
  <div class="task-row-header" data-toggle-row="${card.id}">
    <div style="display:flex; align-items:center; gap:12px; flex:1; min-width:0; overflow:visible;">
      <input type="checkbox" class="task-master-checkbox" data-master="${card.id}" style="width:16px; height:16px; cursor:pointer; accent-color:var(--accent); flex-shrink:0;" ${checkedCount === card.children.length && card.children.length > 0 ? 'checked' : ''} />
      <div class="task-card-icon ${bgClass}" style="width:28px; height:28px; font-size:12px; border-radius:6px; flex-shrink:0;">${card.icon}</div>
      <div class="task-card-title" style="font-size:13px; font-weight:700; white-space:nowrap; overflow:visible; flex-shrink:0;">${esc(card.title)}</div>
    </div>
    <div style="display:flex; align-items:center; gap:8px; flex-shrink:0;">
      ${card.children.length > 0 ? `<span style="font-size:10px; font-weight:700; color:${progress === 100 ? 'var(--accent)' : 'var(--text-soft)'}; background:var(--surface-2); padding:2px 8px; border-radius:var(--r-full); flex-shrink:0;">${checkedCount}/${card.children.length}</span>` : ''}
      <button class="task-card-edit" data-edit-cat="${card.id}" title="Editar" style="background:none;border:none;cursor:pointer;font-size:14px;padding:2px 4px;color:var(--text-soft);">✏️</button>
      <button class="task-card-delete" data-del-cat="${card.id}" title="Eliminar" style="background:none;border:none;cursor:pointer;font-size:14px;padding:2px 4px;color:var(--text-soft);">🗑️</button>
      <div class="task-card-toggle" data-toggle="${card.id}">▼</div>
    </div>
  </div>
  <div class="task-card-items-grid" id="items-${card.id}">
    ${card.children.length > 0 ? `
      <div class="task-progress-bar" style="height:3px; background:var(--border-light); margin:4px 16px 8px; border-radius:var(--r-full); overflow:hidden;">
        <div style="height:100%; width:${progress}%; background:var(--accent); transition:width 0.3s;"></div>
      </div>
    ` : ''}
    ${card.children.map((item, idx) => {
      const isChecked = checks[`${card.id}-${idx}`];
      return `
      <label class="task-item-compact" data-item="${card.id}-${idx}">
        <input type="checkbox" class="task-item-checkbox-input" data-check="${card.id}-${idx}" ${isChecked ? 'checked' : ''}>
        <span class="task-item-text ${isChecked ? 'checked' : ''}" data-text="${card.id}-${idx}" style="font-size:11px;">${esc(item)}</span>
        <button class="task-item-edit" data-edit="${card.id}-${idx}" title="Editar" style="background:none;border:none;cursor:pointer;font-size:12px;padding:2px 4px;color:var(--text-soft);opacity:0.5;margin-left:auto;">✏️</button>
        <button class="task-item-delete" data-del="${card.id}-${idx}" title="Eliminar" style="background:none;border:none;cursor:pointer;font-size:12px;padding:2px 4px;color:var(--text-soft);opacity:0.5;">✕</button>
      </label>`;
    }).join('')}
    <button class="task-add-subtask" data-add="${card.id}">+ Agregar tarea</button>
  </div>
</div>`;
}

function initCardInteractions() {
  // Expandir/contraer tarjetas (modo acordeón: solo una abierta a la vez)
  document.querySelectorAll('.task-row-header').forEach(header => {
    header.addEventListener('click', (e) => {
      if (e.target.closest('button') || e.target.closest('input')) return;
      const id = header.dataset.toggleRow;
      const items = document.getElementById(`items-${id}`);
      const toggle = header.querySelector('.task-card-toggle');
      const isExp = items.classList.contains('expanded');

      // Cerrar todas las demás
      document.querySelectorAll('.task-card-items-grid.expanded').forEach(other => {
        if (other.id === `items-${id}`) return;
        other.classList.remove('expanded');
        const otherId = other.id.replace('items-', '');
        const otherToggle = document.querySelector(`.task-card-toggle[data-toggle="${otherId}"]`);
        const otherHeader = document.querySelector(`.task-row-header[data-toggle-row="${otherId}"]`);
        if (otherToggle) otherToggle.classList.remove('expanded');
        if (otherHeader) otherHeader.classList.remove('expanded');
        expandedCards.delete(otherId);
      });

      if (isExp) {
        items.classList.remove('expanded');
        toggle.classList.remove('expanded');
        header.classList.remove('expanded');
        expandedCards.delete(id);
      } else {
        items.classList.add('expanded');
        toggle.classList.add('expanded');
        header.classList.add('expanded');
        expandedCards.add(id);
      }
    });
  });

  // Restaurar expandidas
  expandedCards.forEach(id => {
    const header = document.querySelector(`.task-row-header[data-toggle-row="${id}"]`);
    if (header && !header.classList.contains('expanded')) header.click();
  });

  // Checkbox maestro (seleccionar todo en categoría)
  document.querySelectorAll('.task-master-checkbox').forEach(master => {
    master.addEventListener('click', (e) => e.stopPropagation());
    master.addEventListener('change', async (e) => {
      e.stopPropagation();
      const id = master.dataset.master;
      const checks = await loadChecks();
      const card = findCard(id);
      if (!card) return;
      card.children.forEach((_, idx) => {
        checks[`${id}-${idx}`] = master.checked;
      });
      await saveChecks(checks);
      await tareasView();
    });
  });

  // Checkbox individual con persistencia
  document.querySelectorAll('.task-item-checkbox-input').forEach(box => {
    box.addEventListener('change', async (e) => {
      e.stopPropagation();
      const id = box.dataset.check;
      const text = document.querySelector(`.task-item-text[data-text="${id}"]`);
      const checks = await loadChecks();
      if (box.checked) {
        text.classList.add('checked');
        checks[id] = true;
      } else {
        text.classList.remove('checked');
        delete checks[id];
      }
      await saveChecks(checks);
    });
  });

  // Eliminar subtarea
  document.querySelectorAll('.task-item-delete').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const fullId = btn.dataset.del;
      const card = findCard(fullId.replace(/-\d+$/, ''));
      if (!card) return;
      const itemIdx = parseInt(fullId.split('-').pop());
      card.children.splice(itemIdx, 1);
      await saveData(TAREAS_DATA);
      const checks = await loadChecks();
      Object.keys(checks).forEach(k => { if (k.startsWith(`${card.id}-`)) delete checks[k]; });
      await saveChecks(checks);
      await tareasView();
    });
  });

  // Editar subtarea
  document.querySelectorAll('.task-item-edit').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const fullId = btn.dataset.edit;
      const card = findCard(fullId.replace(/-\d+$/, ''));
      if (!card) return;
      const itemIdx = parseInt(fullId.split('-').pop());
      const currentVal = card.children[itemIdx];
      showTaskModal('Editar Subtarea', 'Ej: Describir tarea...', currentVal, async (val) => {
        card.children[itemIdx] = val;
        await saveData(TAREAS_DATA);
        await tareasView();
      });
    });
  });

  // Eliminar categoría personalizada
  document.querySelectorAll('.task-card-delete').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = btn.dataset.delCat;
      for (const type of ['empresarial', 'residencial']) {
        const idx = TAREAS_DATA[type].findIndex(c => c.id === id);
        if (idx >= 0) {
          TAREAS_DATA[type].splice(idx, 1);
          await deleteCategory(id);
          await saveData(TAREAS_DATA);
          const checks = await loadChecks();
          Object.keys(checks).forEach(k => { if (k.startsWith(`${id}-`)) delete checks[k]; });
          await saveChecks(checks);
          expandedCards.delete(id);
          toast('Categoría eliminada', 'success');
          await tareasView();
          return;
        }
      }
    });
  });

  // Editar categoría personalizada
  document.querySelectorAll('.task-card-edit').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.dataset.editCat;
      const card = findCard(id);
      if (!card) return;
      showTaskModal('Editar título', '', card.title, async (val) => {
        card.title = val;
        await saveData(TAREAS_DATA);
        await tareasView();
      });
    });
  });

  // Agregar subtarea
  document.querySelectorAll('.task-add-subtask').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.dataset.add;
      showTaskModal('Nueva Subtarea', 'Ej: Describir tarea...', '', async (val) => {
        const card = findCard(id);
        if (card) {
          card.children.push(val);
          await saveData(TAREAS_DATA);
          expandedCards.add(id);
          await tareasView();
        }
      });
    });
  });

  // Agregar tarea personalizada
  const addCustomBtn = document.getElementById('btn-add-custom');
  if (addCustomBtn) {
    addCustomBtn.addEventListener('click', () => {
      showCategoryModal(async (title, type) => {
        const newId = type.substring(0,3) + '-custom-' + Date.now();
        TAREAS_DATA[type].push({ id: newId, icon: '📝', title, children: [] });
        await saveData(TAREAS_DATA);
        expandedCards.add(newId);
        toast('Tarea personalizada agregada', 'success');
        await tareasView();
      });
    });
  }
}

function findCard(id) {
  for (const type of ['empresarial', 'residencial']) {
    const cat = TAREAS_DATA[type].find(c => c.id === id);
    if (cat) return cat;
  }
  return null;
}

function initToolbar() {
  // Búsqueda en tiempo real
  const search = document.getElementById('task-search');
  if (search) {
    search.addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase().trim();
      document.querySelectorAll('.task-row').forEach(row => {
        if (!q) { row.style.display = ''; return; }
        const title = row.querySelector('.task-card-title')?.textContent.toLowerCase() || '';
        const items = Array.from(row.querySelectorAll('.task-item-text')).map(t => t.textContent.toLowerCase());
        const match = title.includes(q) || items.some(i => i.includes(q));
        row.style.display = match ? '' : 'none';
      });
      // Ocultar encabezados de categoría si no hay tarjetas visibles
      document.querySelectorAll('.tasks-category').forEach(cat => {
        const visible = cat.querySelectorAll('.task-row:not([style*="display: none"])').length;
        cat.style.display = visible > 0 ? '' : 'none';
      });
    });
  }

  // Exportar seleccionadas
  const exportBtn = document.getElementById('btn-export');
  if (exportBtn) {
    exportBtn.addEventListener('click', async () => {
      const checks = await loadChecks();
      const selected = [];
      for (const type of ['empresarial', 'residencial']) {
        for (const card of TAREAS_DATA[type]) {
          const items = card.children.filter((_, idx) => checks[`${card.id}-${idx}`]);
          if (items.length > 0) {
            selected.push(`${card.title}:\n${items.map(i => `  ✓ ${i}`).join('\n')}`);
          }
        }
      }
      if (selected.length === 0) {
        toast('No hay tareas seleccionadas', 'warn');
        return;
      }
      const text = selected.join('\n\n');
      navigator.clipboard.writeText(text).then(() => {
        toast(`${selected.length} categorías copiadas al portapapeles`, 'success');
      }).catch(() => {
        toast('No se pudo copiar', 'error');
      });
    });
  }

  // Restaurar valores por defecto
  const resetBtn = document.getElementById('btn-reset');
  if (resetBtn) {
    resetBtn.addEventListener('click', async () => {
      if (confirm('¿Restaurar todas las tareas a los valores por defecto? Se perderán las personalizadas.')) {
        try {
          const supabase = await getSupabase();
          await supabase.from('tareas_data').delete().neq('id', 'dummy');
          await supabase.from('tareas_checks').delete().neq('id', 'dummy');
        } catch (e) {
          console.warn("Error al restaurar base de datos:", e);
        }

        TAREAS_DATA = JSON.parse(JSON.stringify(DEFAULT_DATA));
        await saveData(TAREAS_DATA);
        await saveChecks({});
        expandedCards.clear();
        toast('Tareas restauradas', 'success');
        await tareasView();
      }
    });
  }
}

function showTaskModal(title, placeholder, initialValue, onSave) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.style.zIndex = '9999';

  const box = document.createElement('div');
  box.className = 'modal-box';
  box.style.maxWidth = '400px';

  const head = document.createElement('div');
  head.className = 'modal-head';
  head.innerHTML = `${esc(title)} <button class="modal-close">×</button>`;
  head.querySelector('.modal-close').onclick = () => overlay.remove();

  const body = document.createElement('div');
  body.className = 'modal-body';

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'input';
  input.style.width = '100%';
  input.placeholder = placeholder;
  input.value = initialValue || '';

  body.appendChild(input);

  const foot = document.createElement('div');
  foot.className = 'modal-foot';

  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'btn-secondary';
  cancelBtn.style.padding = '8px 16px';
  cancelBtn.style.borderRadius = 'var(--r-md)';
  cancelBtn.textContent = 'Cancelar';
  cancelBtn.onclick = () => overlay.remove();

  const saveBtn = document.createElement('button');
  saveBtn.className = 'hero-btn-main';
  saveBtn.textContent = 'Guardar';
  saveBtn.onclick = () => {
    const val = input.value.trim();
    if (!val) return;
    onSave(val);
    overlay.remove();
  };

  foot.appendChild(cancelBtn);
  foot.appendChild(saveBtn);

  box.appendChild(head);
  box.appendChild(body);
  box.appendChild(foot);
  overlay.appendChild(box);
  document.body.appendChild(overlay);

  input.focus();
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') saveBtn.click();
  });
}

function showCategoryModal(onSave) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.style.zIndex = '9999';

  const box = document.createElement('div');
  box.className = 'modal-box';
  box.style.maxWidth = '400px';

  const head = document.createElement('div');
  head.className = 'modal-head';
  head.innerHTML = `Nueva Tarea Personalizada <button class="modal-close">×</button>`;
  head.querySelector('.modal-close').onclick = () => overlay.remove();

  const body = document.createElement('div');
  body.className = 'modal-body';
  body.style.display = 'flex';
  body.style.flexDirection = 'column';
  body.style.gap = '16px';

  const labelTitle = document.createElement('label');
  labelTitle.className = 'field-label';
  labelTitle.textContent = 'Título de la Categoría:';
  labelTitle.style.display = 'block';
  labelTitle.style.marginBottom = '8px';
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'input';
  input.style.width = '100%';
  input.placeholder = 'Ej: Mantenimiento de Servidores';
  labelTitle.appendChild(input);

  const labelType = document.createElement('label');
  labelType.className = 'field-label';
  labelType.textContent = 'Sección:';
  labelType.style.display = 'block';
  labelType.style.marginBottom = '8px';
  const select = document.createElement('select');
  select.className = 'select';
  select.style.width = '100%';
  select.innerHTML = `<option value="empresarial">Empresarial</option><option value="residencial">Residencial</option>`;
  labelType.appendChild(select);

  body.appendChild(labelTitle);
  body.appendChild(labelType);

  const foot = document.createElement('div');
  foot.className = 'modal-foot';

  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'btn-secondary';
  cancelBtn.style.padding = '8px 16px';
  cancelBtn.style.borderRadius = 'var(--r-md)';
  cancelBtn.textContent = 'Cancelar';
  cancelBtn.onclick = () => overlay.remove();

  const saveBtn = document.createElement('button');
  saveBtn.className = 'hero-btn-main';
  saveBtn.textContent = 'Guardar';
  saveBtn.onclick = () => {
    const val = input.value.trim();
    if (!val) return;
    onSave(val, select.value);
    overlay.remove();
  };

  foot.appendChild(cancelBtn);
  foot.appendChild(saveBtn);

  box.appendChild(head);
  box.appendChild(body);
  box.appendChild(foot);
  overlay.appendChild(box);
  document.body.appendChild(overlay);

  input.focus();
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') saveBtn.click();
  });
}
