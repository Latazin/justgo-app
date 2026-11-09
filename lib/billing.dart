// JustGo — compras pela Google Play (Passe da Temporada)
// O app web pede: listar preços, comprar, finalizar e restaurar.
// Cada compra volta para o app web, que confere no servidor (pass-verify)
// e só então pede para finalizar (reconhecer / consumir) aqui.
import 'dart:async';
import 'dart:io';

import 'package:in_app_purchase/in_app_purchase.dart';
import 'package:in_app_purchase_android/in_app_purchase_android.dart';

class Billing {
  static final iap = InAppPurchase.instance;
  static StreamSubscription<List<PurchaseDetails>>? _sub;
  static final Map<String, PurchaseDetails> _pending = {};
  static final Map<String, ProductDetails> _products = {};
  static void Function(Map<String, dynamic> ev)? onEvent;

  static void init() {
    _sub ??= iap.purchaseStream.listen((list) {
      for (final p in list) {
        _handle(p);
      }
    }, onError: (_) {});
  }

  static void _handle(PurchaseDetails p) {
    final tok = p.verificationData.serverVerificationData;
    switch (p.status) {
      case PurchaseStatus.purchased:
      case PurchaseStatus.restored:
        _pending[tok] = p;
        onEvent?.call({'type': 'purchased', 'product': p.productID, 'token': tok, 'order': p.purchaseID});
        break;
      case PurchaseStatus.pending:
        onEvent?.call({'type': 'pending', 'product': p.productID});
        break;
      case PurchaseStatus.error:
        onEvent?.call({'type': 'error', 'product': p.productID, 'msg': p.error?.message});
        if (p.pendingCompletePurchase) iap.completePurchase(p);
        break;
      case PurchaseStatus.canceled:
        onEvent?.call({'type': 'canceled', 'product': p.productID});
        if (p.pendingCompletePurchase) iap.completePurchase(p);
        break;
    }
  }

  static Future<Map<String, dynamic>> query(List<String> ids) async {
    init();
    if (!await iap.isAvailable()) return {'ok': false, 'error': 'unavailable'};
    final r = await iap.queryProductDetails(ids.toSet());
    for (final d in r.productDetails) {
      _products[d.id] = d;
    }
    return {
      'ok': true,
      'items': [
        for (final d in r.productDetails) {'id': d.id, 'price': d.price, 'raw': d.rawPrice, 'cur': d.currencyCode, 'title': d.title}
      ],
      'missing': r.notFoundIDs,
    };
  }

  static Future<Map<String, dynamic>> buy(String id, bool consumable, String? user) async {
    init();
    if (!await iap.isAvailable()) return {'ok': false, 'error': 'unavailable'};
    var d = _products[id];
    if (d == null) {
      await query([id]);
      d = _products[id];
    }
    if (d == null) return {'ok': false, 'error': 'notFound'};
    final param = PurchaseParam(productDetails: d, applicationUserName: user);
    final ok = consumable ? await iap.buyConsumable(purchaseParam: param, autoConsume: false) : await iap.buyNonConsumable(purchaseParam: param);
    return {'ok': ok};
  }

  // depois que o servidor confirmou: reconhece (passe) ou consome (pular níveis, pode comprar de novo)
  static Future<Map<String, dynamic>> finish(String token, bool consumable) async {
    final p = _pending.remove(token);
    if (p == null) return {'ok': false, 'error': 'notPending'};
    try {
      if (Platform.isAndroid && consumable) {
        await iap.getPlatformAddition<InAppPurchaseAndroidPlatformAddition>().consumePurchase(p);
      }
      if (p.pendingCompletePurchase) await iap.completePurchase(p);
    } catch (e) {
      return {'ok': false, 'error': '$e'};
    }
    return {'ok': true};
  }

  // compras que ficaram sem finalizar (app fechou no meio, reinstalou…) voltam pelo fluxo normal
  static Future<void> restore() async {
    init();
    if (await iap.isAvailable()) await iap.restorePurchases();
  }
}
