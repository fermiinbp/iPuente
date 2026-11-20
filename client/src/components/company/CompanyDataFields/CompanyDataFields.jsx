// Campos con los datos de la empresa del alta (wireframe 10): nombre, CIF, teléfono, persona de contacto, email de
// contacto y ciudad. Los usan CompanyRegister (alta) y CompanyRequestStatus («Editar» y «Corregir y reenviar»).
// Controlados: `values` y `errors` (mensaje por campo, de utils/companyForm.js) y `onChange(event)`, que lee `name`.
import Input from '@/components/ui/Input/Input.jsx';
import styles from './CompanyDataFields.module.css';

export default function CompanyDataFields({ values, errors = {}, onChange, disabled = false }) {
  const field = (name) => ({
    name,
    value: values[name],
    error: errors[name],
    onChange,
    disabled,
    variant: 'boxed',
  });

  return (
    <div className={styles.fields}>
      <Input
        {...field('nombreEmpresa')}
        label="Nombre de la empresa"
        placeholder="Oficinas Sur SL"
        autoComplete="organization"
        maxLength={100}
        className={styles.full}
      />
      <Input
        {...field('cif')}
        label="CIF"
        placeholder="B12345674"
        autoComplete="off"
        maxLength={12}
      />
      <Input
        {...field('telefono')}
        label="Teléfono"
        type="tel"
        placeholder="600 000 000"
        autoComplete="tel-national"
        inputMode="tel"
      />
      <Input
        {...field('personaContacto')}
        label="Persona de contacto"
        placeholder="Nombre y apellidos"
        autoComplete="name"
        maxLength={100}
        className={styles.full}
      />
      <Input
        {...field('emailContacto')}
        label="Email de contacto"
        type="email"
        placeholder="hola@empresa.com"
        hint="Es el que verán los clientes. Puede ser el mismo que el de acceso."
        autoComplete="email"
        className={styles.full}
      />
      <Input
        {...field('ciudad')}
        label="Ciudad"
        placeholder="Sevilla"
        autoComplete="address-level2"
        maxLength={100}
        className={styles.full}
      />
    </div>
  );
}
