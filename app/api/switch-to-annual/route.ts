<button
            disabled={isZipping || processedEstimates.length === 0}
            onClick={() => {
              if (profile.subscription_tier !== 'pro') {
                setProLockModal('zip');
                return;
              }
              handleExportZip();
            }}
            className="flex-1 sm:flex-none bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 disabled:opacity-40 font-black uppercase tracking-widest text-[10px] px-5 rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer"
            style={{ height: '31px' }}
          >
            <svg
              className="w-3.5 h-3.5 text-gray-400"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"
              />
            </svg>
            {isZipping
              ? lang.archiving
              : t(lang.downloadPdfsZip, {
                  count: processedEstimates.length
                })}
          </button>