export default function OrderStatusBadgeComponent({ status }) {
  let backgroundColor = '#e0e0e0';
  let color = '#333';
  
  switch (status) {
    case 'CREADO':
      backgroundColor = '#fff3cd'; // Amarillo tenue
      color = '#856404';
      break;
    case 'ACEPTADO':
      backgroundColor = '#cce5ff'; // Azul tenue
      color = '#004085';
      break;
    case 'EN_PREPARACION':
      backgroundColor = '#ffeeba'; // Naranja tenue
      color = '#856404';
      break;
    case 'DESPACHADO':
      backgroundColor = '#d1ecf1'; // Cyan tenue
      color = '#0c5460';
      break;
    case 'ENTREGADO':
      backgroundColor = '#d4edda'; // Verde tenue
      color = '#155724';
      break;
    case 'CANCELADO':
      backgroundColor = '#f8d7da'; // Rojo tenue
      color = '#721c24';
      break;
    default:
      break;
  }

  return (
    <span style={{
      display: 'inline-block',
      padding: '0.25rem 0.5rem',
      borderRadius: '4px',
      fontSize: '0.85rem',
      fontWeight: 'bold',
      backgroundColor,
      color
    }}>
      {status}
    </span>
  );
}
