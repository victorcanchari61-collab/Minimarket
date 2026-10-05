<?php

namespace App\Enums;

enum SystemKey: string
{
    case Pos = 'pos';
    case Erp = 'erp';
    case Scm = 'scm';
    case Wms = 'wms';
    case Hcm = 'hcm';
    case Crm = 'crm';
    case Bi = 'bi';
}
