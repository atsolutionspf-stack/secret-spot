import { Link, useParams } from "react-router-dom";
import { useI18n } from "@/lib/i18n";
import { SITE } from "@/lib/site";

type LegalKey = "aviso-legal" | "privacidad" | "cookies" | "condiciones";

const titles: Record<LegalKey, string> = {
  "aviso-legal": "Aviso legal",
  privacidad: "Política de privacidad",
  cookies: "Política de cookies",
  condiciones: "Condiciones de reservas y pedidos",
};

function Privacy() {
  return <div className="space-y-6">
    <p>Esta política informa sobre el tratamiento de los datos personales facilitados a través de la web de Secret Spot, de conformidad con el Reglamento (UE) 2016/679 (RGPD) y la Ley Orgánica 3/2018 (LOPDGDD).</p>
    <section><h2 className="legal-h">1. Responsable del tratamiento</h2><p><strong>Responsable:</strong> {SITE.legal.name} · <strong>Nombre comercial:</strong> Secret Spot.</p><p><strong>Domicilio:</strong> {SITE.legal.address}.</p><p><strong>Correo:</strong> <a href={`mailto:${SITE.legal.email}`}>{SITE.legal.email}</a> · <strong>Teléfono:</strong> {SITE.legal.phone}.</p></section>
    <section><h2 className="legal-h">2. Datos que recogemos</h2><p><strong>Reservas:</strong> nombre, teléfono, correo electrónico, fecha, hora, número de personas y observaciones opcionales.</p><p><strong>Pedidos para recoger:</strong> nombre, teléfono, productos y cantidades, hora de recogida y observaciones opcionales. El pago se realiza en el establecimiento; la web no recoge datos de tarjetas.</p><p><strong>Contacto:</strong> nombre, correo electrónico, teléfono si se facilita, asunto y contenido del mensaje.</p><p><strong>Datos técnicos:</strong> preferencias de idioma, contenido temporal del carrito y datos de sesión necesarios para el acceso a las funciones de administración.</p><p>Se recomienda no introducir datos médicos ni información especialmente sensible en los campos de observaciones o mensajes.</p></section>
    <section><h2 className="legal-h">3. Finalidades y bases jurídicas</h2><ul><li>Gestionar reservas y contactar en relación con ellas: medidas precontractuales solicitadas por el usuario y prestación del servicio.</li><li>Gestionar y preparar pedidos para recoger: medidas precontractuales y ejecución del servicio solicitado.</li><li>Responder consultas: medidas precontractuales cuando proceda o interés legítimo en atender las comunicaciones recibidas.</li><li>Proteger y mantener la web: interés legítimo en garantizar la seguridad y disponibilidad del servicio.</li><li>Atender obligaciones legales: cumplimiento de obligaciones legales aplicables.</li></ul><p>Los datos no se utilizarán para enviar publicidad. Cualquier comunicación comercial futura que requiera consentimiento se gestionará mediante una autorización específica y separada.</p></section>
    <section><h2 className="legal-h">4. Conservación</h2><p>Los datos se conservarán durante el tiempo necesario para gestionar la reserva, pedido o consulta y atender incidencias o responsabilidades. Cuando existan obligaciones legales de conservación, los datos afectados se mantendrán durante los plazos exigidos y, cuando corresponda, bloqueados. Después se suprimirán de forma segura.</p></section>
    <section><h2 className="legal-h">5. Destinatarios y proveedores</h2><p>Podrán acceder a los datos proveedores tecnológicos que prestan servicios necesarios para la web:</p><ul><li><strong>Supabase:</strong> infraestructura de base de datos y autenticación.</li><li><strong>Cloudflare:</strong> alojamiento, distribución y seguridad de la web.</li><li><strong>AT Solutions:</strong> desarrollo, mantenimiento y soporte técnico. Cuando accede a datos personales para prestar estos servicios, actúa como encargado del tratamiento conforme al contrato suscrito con el responsable.</li><li><strong>Resend:</strong> integración técnica de correo electrónico para notificaciones, si se encuentra activada y operativa.</li></ul><p>Estos proveedores tratarán los datos conforme a sus funciones y, cuando corresponda, a las instrucciones del responsable y al contrato de encargo aplicable. Los datos no se venden ni se ceden a terceros para sus propios fines comerciales. Podrán comunicarse a autoridades cuando exista obligación legal.</p></section>
    <section><h2 className="legal-h">6. Transferencias internacionales</h2><p>La base de datos principal del proyecto está configurada en una región de la Unión Europea. Algunos proveedores tecnológicos podrían tratar determinados datos desde otros países o utilizar infraestructura internacional. Cuando exista una transferencia fuera del Espacio Económico Europeo, deberá estar amparada por un mecanismo válido del RGPD, como una decisión de adecuación o garantías apropiadas. El usuario puede solicitar información sobre las garantías aplicables escribiendo al responsable.</p></section>
    <section><h2 className="legal-h">7. Carácter obligatorio de los datos</h2><p>Los campos identificados como obligatorios son necesarios para tramitar la reserva, el pedido o la consulta. Si no se facilitan, puede que no sea posible prestar el servicio. Las observaciones son voluntarias.</p></section>
    <section><h2 className="legal-h">8. Derechos</h2><p>El usuario puede solicitar el acceso, rectificación, supresión, oposición, limitación y portabilidad de sus datos, así como retirar el consentimiento cuando el tratamiento se base en él. Para ello puede escribir a <a href={`mailto:${SITE.legal.email}`}>{SITE.legal.email}</a>, indicando el derecho que desea ejercer y aportando información suficiente para verificar su identidad.</p><p>También puede reclamar ante la Agencia Española de Protección de Datos: <a href="https://www.aepd.es/" target="_blank" rel="noreferrer">www.aepd.es</a>.</p></section>
    <section><h2 className="legal-h">9. Seguridad</h2><p>El responsable aplica medidas técnicas y organizativas razonables para proteger los datos frente a accesos no autorizados, pérdida, alteración o divulgación indebida. El acceso de proveedores técnicos se limita a lo necesario para sus servicios. Ningún sistema conectado a Internet puede garantizar seguridad absoluta.</p></section>
    <section><h2 className="legal-h">10. Menores</h2><p>La web no está diseñada específicamente para recoger datos de menores. Cuando corresponda conforme a la normativa, los menores deberán utilizar los formularios con intervención de sus representantes legales.</p></section>
    <section><h2 className="legal-h">11. Decisiones automatizadas</h2><p>No se adoptan decisiones automatizadas con efectos jurídicos sobre los usuarios ni se elaboran perfiles con efectos significativos a partir de los datos de estos formularios.</p></section>
    <section><h2 className="legal-h">12. Cambios</h2><p>Esta política podrá actualizarse para reflejar cambios legales, técnicos o en los servicios. La versión vigente estará disponible en esta página.</p></section>
  </div>;
}

function LegalNotice() {
  return <div className="space-y-5">
    <p>En cumplimiento del artículo 10 de la Ley 34/2002, de servicios de la sociedad de la información y de comercio electrónico (LSSI-CE), se facilita la información del titular de esta web:</p>
    <p><strong>Titular:</strong> {SITE.legal.name}<br/><strong>Nombre comercial:</strong> Secret Spot<br/><strong>Domicilio:</strong> {SITE.legal.address}<br/><strong>Teléfono:</strong> {SITE.legal.phone}<br/><strong>Correo electrónico:</strong> {SITE.legal.email}</p>
    <section><h2 className="legal-h">Objeto</h2><p>Este sitio web ofrece información sobre Secret Spot y permite solicitar reservas y, cuando el servicio esté habilitado, realizar pedidos para recoger en el establecimiento.</p></section>
    <section><h2 className="legal-h">Condiciones de uso</h2><p>El usuario se compromete a utilizar la web de forma lícita, diligente y sin perjudicar los derechos o intereses de terceros ni el funcionamiento del servicio.</p></section>
    <section><h2 className="legal-h">Propiedad intelectual</h2><p>Los contenidos, diseños, textos, fotografías, marcas y demás elementos de la web están protegidos por la normativa aplicable. No podrán reproducirse o utilizarse sin autorización de sus titulares, salvo en los casos permitidos legalmente.</p></section>
    <section><h2 className="legal-h">Responsabilidad y enlaces</h2><p>Se adoptan medidas razonables para mantener la información actualizada y la web disponible, sin garantizar la ausencia de errores o interrupciones. Los enlaces a sitios de terceros se facilitan únicamente como referencia; sus contenidos y políticas son responsabilidad de sus respectivos titulares.</p></section>
    <p>La web se rige por la legislación española y de la Unión Europea que resulte aplicable.</p>
  </div>;
}

function Cookies() {
  return <div className="space-y-5">
    <p>Esta política explica el uso de tecnologías de almacenamiento en el navegador en la web de Secret Spot.</p>
    <section><h2 className="legal-h">Tecnologías funcionales identificadas</h2><ul><li><strong>ss_lang:</strong> recuerda el idioma elegido por el usuario.</li><li><strong>ss_cart_v1:</strong> conserva temporalmente los productos y cantidades del carrito.</li><li><strong>Sesión de administración de Supabase:</strong> permite mantener la sesión autenticada del personal autorizado y proteger el acceso al panel.</li></ul><p>Estas tecnologías se utilizan para prestar funciones solicitadas por el usuario, mantener preferencias o proteger el acceso al área privada.</p></section>
    <section><h2 className="legal-h">Cookies de terceros y analítica</h2><p>La configuración del código revisada hasta la fecha no mostraba herramientas de analítica publicitaria ni píxeles de publicidad. La presencia de cookies adicionales puede depender de la configuración de alojamiento, seguridad o servicios externos y debe comprobarse en el navegador en la versión publicada.</p></section>
    <section><h2 className="legal-h">Cómo gestionar el almacenamiento</h2><p>El usuario puede eliminar los datos almacenados desde la configuración de su navegador. Si bloquea el almacenamiento funcional, algunas características —como recordar el idioma, conservar el carrito o mantener la sesión de administración— pueden dejar de funcionar correctamente.</p></section>
    <p>Si se incorporan cookies no necesarias o tecnologías de seguimiento que requieran consentimiento, se actualizará esta política y se mostrará un mecanismo válido para aceptar o rechazar dichas tecnologías antes de activarlas.</p>
  </div>;
}

function Terms() {
  return <div className="space-y-5">
    <section><h2 className="legal-h">Reservas</h2><p>El envío del formulario constituye una solicitud de reserva, no una confirmación automática. La reserva quedará pendiente hasta que Secret Spot la confirme por los medios de contacto facilitados. El usuario debe proporcionar datos correctos y comunicar cualquier cambio o cancelación con la mayor antelación posible, contactando con el establecimiento.</p></section>
    <section><h2 className="legal-h">Pedidos para recoger</h2><p>Los pedidos se preparan para su recogida en el establecimiento en la hora indicada, siempre que el servicio esté disponible y el pedido haya sido aceptado. El pago se realiza en el establecimiento al recogerlo; no se efectúan pagos con tarjeta a través de esta web.</p><p>Los productos, precios y disponibilidad son los mostrados en la web en el momento de realizar el pedido, sujetos a posibles errores manifiestos o falta de disponibilidad. Si hubiera algún problema que impida preparar el pedido, el establecimiento contactará con el cliente.</p></section>
    <section><h2 className="legal-h">Datos facilitados</h2><p>El usuario declara que los datos introducidos son exactos y que está autorizado para facilitarlos. La información personal se trata conforme a la <Link className="text-amber-400 underline" to="/privacidad">Política de Privacidad</Link>.</p></section>
    <section><h2 className="legal-h">Contacto</h2><p>Para modificar o cancelar una reserva o pedido, el usuario puede contactar directamente con Secret Spot a través del teléfono <a href={SITE.phoneHref}>{SITE.phone}</a>.</p></section>
  </div>;
}

export default function LegalPage() {
  const { page } = useParams<{ page: LegalKey }>();
  const { lang } = useI18n();
  const key = (page ?? "privacidad") as LegalKey;
  const valid = Object.prototype.hasOwnProperty.call(titles, key);
  const title = valid ? titles[key] : "Información legal";
  const content = key === "aviso-legal" ? <LegalNotice/> : key === "cookies" ? <Cookies/> : key === "condiciones" ? <Terms/> : <Privacy/>;
  return <main className="min-h-screen bg-[#080B10] px-4 py-16 text-stone-300 sm:px-6">
    <article className="mx-auto max-w-3xl">
      <Link to="/" className="text-sm font-semibold text-amber-400 hover:text-amber-300">← {lang === "en" ? "Back to Secret Spot" : "Volver a Secret Spot"}</Link>
      <h1 className="mt-8 font-heading text-4xl font-black uppercase text-white sm:text-5xl">{title}</h1>
      <p className="mt-3 text-xs text-stone-500">{lang === "en" ? "Last updated" : "Última actualización"}: 5 de noviembre de 2026</p>
      <div className="legal-content mt-8 text-sm leading-7">{content}</div>
    </article>
  </main>;
}
