import { serviceClient, publicClient, sendError } from './_lib.js';

export default async function handler(req,res){
  try{
    if(req.method!=='GET')return res.status(405).json({error:'Method not allowed'});
    let svc;
    try{svc=serviceClient()}catch(_){svc=publicClient()}
    const [categories,services,packages,packageItems]=await Promise.all([
      svc.from('catalog_categories').select('id,name,slug,sort_order').eq('active',true).order('sort_order').order('name'),
      svc.from('catalog_services').select('id,category_id,product_code,name,description,price').eq('active',true).order('name'),
      svc.from('catalog_packages').select('id,category_id,product_code,name,description,original_price,new_price').eq('active',true).order('name'),
      svc.from('catalog_package_items').select('id,package_id,service_id,item_name,quantity,sort_order').order('sort_order')
    ]);
    for(const result of [categories,services,packages,packageItems])if(result.error)throw result.error;
    res.setHeader('Cache-Control','public, max-age=0, s-maxage=30, stale-while-revalidate=60');
    return res.status(200).json({
      categories:categories.data||[],
      services:(services.data||[]).map(x=>({...x,price:Number(x.price||0)})),
      packages:(packages.data||[]).map(x=>({...x,original_price:Number(x.original_price||0),new_price:Number(x.new_price||0)})),
      packageItems:packageItems.data||[]
    });
  }catch(e){return sendError(res,e)}
}
