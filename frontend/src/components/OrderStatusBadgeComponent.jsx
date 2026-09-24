export default function OrderStatusBadgeComponent({ status }) {
  let backgroundColor = '#e0e0e0';
  let color = '#333';
  
  switch (status) {
    case 'CREADO':
      backgroundColor = '#fef3c7'; // amber-100
      color = '#92400e';           // amber-800
      break;
    case 'ACEPTADO':
    case 'EN_PREPARACION':
    case 'DESPACHADO':
      backgroundColor = '#f3e8ff'; // purple-100
      color = '#6b21a8';           // purple-800
      break;
    case 'ENTREGADO':
      backgroundColor = '#d1fae5'; // emerald-100
      color = '#065f46';           // emerald-800
      break;
    case 'CANCELADO':
      backgroundColor = '#fee2e2'; // red-100
      color = '#991b1b';           // red-800
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
