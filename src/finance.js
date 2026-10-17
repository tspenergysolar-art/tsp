const cents=value=>Math.round((Number(value)||0)*100);
const amount=value=>cents(value)/100;
const isoTime=value=>{
  const match=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value||''));
  return match?Date.UTC(Number(match[1]),Number(match[2])-1,Number(match[3])):null;
};

export const activePaid=(payments,invoiceId)=>amount(payments
  .filter(payment=>payment.invoiceId===invoiceId&&payment.status==='active')
  .reduce((sum,payment)=>sum+Number(payment.amount||0),0));

export function supersededInvoiceIds(invoices){
  return new Set(invoices
    .filter(invoice=>invoice.status!=='cancelled'&&invoice.supersedesInvoiceId)
    .map(invoice=>invoice.supersedesInvoiceId));
}

export function financialRows(invoices,payments,today){
  const superseded=supersededInvoiceIds(invoices),todayTime=isoTime(today);
  return invoices.map(invoice=>{
    const total=amount(invoice.total),received=activePaid(payments,invoice.id);
    let status='pending',balance=amount(Math.max(0,total-received)),daysOverdue=0;
    if(invoice.status==='cancelled'){status='cancelled';balance=0;}
    else if(superseded.has(invoice.id)){status='superseded';balance=0;}
    else if(balance<=.009){status='paid';balance=0;}
    else{
      const dueTime=isoTime(invoice.dueDate);
      if(dueTime!==null&&todayTime!==null&&dueTime<todayTime){
        status='overdue';daysOverdue=Math.floor((todayTime-dueTime)/86400000);
      }else if(received>.009)status='partial';
    }
    return {...invoice,total,received,balance,status,daysOverdue,isEffective:!['cancelled','superseded'].includes(status)};
  });
}

export function financialSummary(rows,today){
  const effective=rows.filter(row=>row.isEffective),todayTime=isoTime(today);
  const summary=effective.reduce((result,row)=>{
    result.billed=amount(result.billed+row.total);
    result.received=amount(result.received+Math.min(row.total,row.received));
    result.pending=amount(result.pending+row.balance);
    if(row.status==='overdue')result.overdue=amount(result.overdue+row.balance);
    const dueTime=isoTime(row.dueDate);
    if(row.balance>.009&&dueTime!==null&&todayTime!==null&&dueTime>=todayTime&&dueTime<=todayTime+7*86400000)result.dueSoon=amount(result.dueSoon+row.balance);
    return result;
  },{billed:0,received:0,pending:0,overdue:0,dueSoon:0});
  summary.defaultRate=summary.pending?summary.overdue/summary.pending*100:0;
  return summary;
}

export function agingSummary(rows){
  return rows.filter(row=>row.isEffective&&row.balance>.009).reduce((result,row)=>{
    if(row.status!=='overdue')result.current=amount(result.current+row.balance);
    else if(row.daysOverdue<=7)result.days1to7=amount(result.days1to7+row.balance);
    else if(row.daysOverdue<=30)result.days8to30=amount(result.days8to30+row.balance);
    else if(row.daysOverdue<=60)result.days31to60=amount(result.days31to60+row.balance);
    else result.over60=amount(result.over60+row.balance);
    return result;
  },{current:0,days1to7:0,days8to30:0,days31to60:0,over60:0});
}

export const financeStatusLabels={pending:'Pendente',partial:'Parcial',overdue:'Vencida',paid:'Paga',superseded:'Substituída',cancelled:'Cancelada'};
