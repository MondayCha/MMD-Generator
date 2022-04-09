import { toast, resolveValue, Toaster } from 'react-hot-toast';
import { X } from 'tabler-icons-react';

const AlertContainer = () => {
  return (
    <Toaster position="bottom-center">
      {(t) => (
        // https://github.com/timolins/react-hot-toast/issues/153
        <div
          className={`${
            t.visible ? 'animate-enter' : 'animate-leave'
          } p-2 bg-indigo-800 items-center text-indigo-100 leading-none rounded-xl flex lg:inline-flex`}
          role="alert"
        >
          <span className="font-semibold mr-1 ml-1 text-left flex-auto">
            {resolveValue(t.message, t)}
          </span>
          <span
            className="flex rounded-full bg-indigo-500 text-xs font-bold p-1 ml-1 bg-opacity-25 hover:bg-opacity-50 cursor-pointer"
            onClick={() => toast.dismiss(t.id)}
          >
            <X size={12} strokeWidth={3} />
          </span>
        </div>
      )}
    </Toaster>
  );
};

export default AlertContainer;
